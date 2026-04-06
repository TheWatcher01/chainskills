/**
 * Tests for trace-informed agent — feedback loop decorator.
 */

import { describe, it, expect, vi } from 'vitest';
import { createTraceInformedAgent } from '#adapters/agents/trace-informed-agent.js';
import type { AgentProvider } from '#core/ports/agent-provider.port.js';
import type { TraceStore, TraceStats } from '#core/ports/trace-store.port.js';
import type { ExecutionTrace } from '#core/entities/execution-trace.js';

function createMockAgent(): AgentProvider {
    return {
        invoke: vi.fn(async () => ({
            ok: true as const,
            value: { content: 'response', model: 'test' },
        })),
        has: () => true,
        list: () => ['copilot'],
    };
}

function createMockTraceStore(traces: ExecutionTrace[] = []): TraceStore {
    return {
        append: vi.fn(),
        flush: vi.fn(async () => {}),
        query: vi.fn(async () => traces),
        count: vi.fn(async () => traces.length),
        stats: vi.fn(async () => ({
            total_traces: 0, total_runs: 0,
            by_status: {} as TraceStats['by_status'],
            by_directive: {},
            avg_duration_ms: 0, avg_confidence: 0, unique_workflows: 0,
        })),
    };
}

describe('TraceInformedAgent', () => {
    it('should pass through when disabled', async () => {
        const delegate = createMockAgent();
        const store = createMockTraceStore();
        const agent = createTraceInformedAgent(delegate, store, { enabled: false });

        await agent.invoke({ agent: 'copilot', prompt: 'test' });

        expect(delegate.invoke).toHaveBeenCalledWith({ agent: 'copilot', prompt: 'test' });
        expect(store.query).not.toHaveBeenCalled();
    });

    it('should inject few-shot examples when enabled and traces available', async () => {
        const delegate = createMockAgent();
        const traces: ExecutionTrace[] = [{
            run_id: 'run-1', workflow_name: 'wf', step_id: 's1',
            directive_type: 'agent', timestamp: '2026-01-01', duration_ms: 100,
            status: 'ok', input: 'Example input', output: 'Example output',
            confidence_score: 0.9,
        }];
        const store = createMockTraceStore(traces);
        const agent = createTraceInformedAgent(delegate, store, { enabled: true, minConfidence: 0.8 });

        await agent.invoke({ agent: 'copilot', prompt: 'new task' });

        expect(store.query).toHaveBeenCalled();
        const call = (delegate.invoke as ReturnType<typeof vi.fn>).mock.calls[0]![0];
        expect(call.systemPrompt).toContain('Example input');
        expect(call.systemPrompt).toContain('Example output');
    });

    it('should not inject when no traces match', async () => {
        const delegate = createMockAgent();
        const store = createMockTraceStore([]);
        const agent = createTraceInformedAgent(delegate, store, { enabled: true });

        await agent.invoke({ agent: 'copilot', prompt: 'test' });

        const call = (delegate.invoke as ReturnType<typeof vi.fn>).mock.calls[0]![0];
        expect(call.systemPrompt).toBeUndefined();
    });

    it('should limit examples to maxExamples', async () => {
        const delegate = createMockAgent();
        const traces: ExecutionTrace[] = Array.from({ length: 10 }, (_, i) => ({
            run_id: `run-${i}`, workflow_name: 'wf', step_id: `s${i}`,
            directive_type: 'agent', timestamp: '2026-01-01', duration_ms: 100,
            status: 'ok' as const, input: `Input ${i}`, output: `Output ${i}`,
            confidence_score: 0.9,
        }));
        const store = createMockTraceStore(traces);
        const agent = createTraceInformedAgent(delegate, store, { enabled: true, maxExamples: 2 });

        await agent.invoke({ agent: 'copilot', prompt: 'test' });

        const call = (delegate.invoke as ReturnType<typeof vi.fn>).mock.calls[0]![0];
        const exampleCount = (call.systemPrompt as string).match(/Example \d+:/g)?.length ?? 0;
        expect(exampleCount).toBeLessThanOrEqual(2);
    });

    it('should delegate has() and list() to original agent', () => {
        const delegate = createMockAgent();
        const store = createMockTraceStore();
        const agent = createTraceInformedAgent(delegate, store);

        expect(agent.has('copilot')).toBe(true);
        expect(agent.list()).toEqual(['copilot']);
    });

    it('should gracefully handle trace query errors', async () => {
        const delegate = createMockAgent();
        const store = createMockTraceStore();
        (store.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('CRAG down'));

        const agent = createTraceInformedAgent(delegate, store, { enabled: true });

        // Should not throw
        const result = await agent.invoke({ agent: 'copilot', prompt: 'test' });
        expect(result.ok).toBe(true);
    });
});
