/**
 * Tests for distillation service — traces to fine-tuning JSONL.
 */

import { describe, it, expect } from 'vitest';
import { distillTraces, toJsonl, distillStats } from '#core/services/distillation.js';
import type { ExecutionTrace } from '#core/entities/execution-trace.js';

function makeTrace(overrides: Partial<ExecutionTrace> = {}): ExecutionTrace {
    return {
        run_id: 'run-001',
        workflow_name: 'test-workflow',
        step_id: 'step-1',
        directive_type: 'agent',
        timestamp: '2026-04-06T00:00:00Z',
        duration_ms: 100,
        status: 'ok',
        input: 'Analyze this code',
        output: 'The code looks clean.',
        model: 'gpt-4o',
        confidence_score: 0.9,
        ...overrides,
    };
}

describe('distillTraces', () => {
    it('should extract examples from high-confidence agent traces', () => {
        const traces = [makeTrace()];
        const examples = distillTraces(traces);
        expect(examples).toHaveLength(1);
        expect(examples[0]!.messages).toHaveLength(3);
        expect(examples[0]!.messages[0]!.role).toBe('system');
        expect(examples[0]!.messages[1]!.role).toBe('user');
        expect(examples[0]!.messages[2]!.role).toBe('assistant');
    });

    it('should filter out low-confidence traces', () => {
        const traces = [
            makeTrace({ confidence_score: 0.9 }),
            makeTrace({ confidence_score: 0.3, step_id: 's2' }),
        ];
        const examples = distillTraces(traces, { minConfidence: 0.5 });
        expect(examples).toHaveLength(1);
    });

    it('should filter out error traces', () => {
        const traces = [
            makeTrace({ status: 'ok' }),
            makeTrace({ status: 'error', step_id: 's2' }),
        ];
        const examples = distillTraces(traces);
        expect(examples).toHaveLength(1);
    });

    it('should only include agent/handoff directive types', () => {
        const traces = [
            makeTrace({ directive_type: 'agent' }),
            makeTrace({ directive_type: 'call', step_id: 's2' }),
            makeTrace({ directive_type: 'handoff', step_id: 's3' }),
        ];
        const examples = distillTraces(traces);
        expect(examples).toHaveLength(2);
    });

    it('should skip traces with empty input or output', () => {
        const traces = [
            makeTrace({ input: '' }),
            makeTrace({ output: '', step_id: 's2' }),
        ];
        const examples = distillTraces(traces);
        expect(examples).toHaveLength(0);
    });

    it('should include metadata when enabled', () => {
        const examples = distillTraces([makeTrace()], { includeMetadata: true });
        expect(examples[0]!._metadata).toBeDefined();
        expect(examples[0]!._metadata!.run_id).toBe('run-001');
        expect(examples[0]!._metadata!.model).toBe('gpt-4o');
    });

    it('should exclude metadata when disabled', () => {
        const examples = distillTraces([makeTrace()], { includeMetadata: false });
        expect(examples[0]!._metadata).toBeUndefined();
    });

    it('should use custom system prompt', () => {
        const examples = distillTraces([makeTrace()], { systemPrompt: 'You are a code reviewer.' });
        expect(examples[0]!.messages[0]!.content).toBe('You are a code reviewer.');
    });
});

describe('toJsonl', () => {
    it('should serialize examples to JSONL', () => {
        const examples = distillTraces([makeTrace()]);
        const jsonl = toJsonl(examples);
        const lines = jsonl.trim().split('\n');
        expect(lines).toHaveLength(1);
        const parsed = JSON.parse(lines[0]!);
        expect(parsed.messages).toHaveLength(3);
    });

    it('should return empty string for no examples', () => {
        expect(toJsonl([])).toBe('');
    });
});

describe('distillStats', () => {
    it('should compute correct stats', () => {
        const traces = [
            makeTrace({ model: 'gpt-4o', confidence_score: 0.9 }),
            makeTrace({ model: 'gpt-4o', confidence_score: 0.8, step_id: 's2' }),
            makeTrace({ model: 'sonnet', confidence_score: 0.7, step_id: 's3' }),
            makeTrace({ status: 'error', step_id: 's4' }),
        ];
        const examples = distillTraces(traces, { minConfidence: 0.5 });
        const stats = distillStats(traces, examples);

        expect(stats.totalTraces).toBe(4);
        expect(stats.filteredIn).toBe(3);
        expect(stats.filteredOut).toBe(1);
        expect(stats.byModel['gpt-4o']).toBe(2);
        expect(stats.byModel['sonnet']).toBe(1);
        expect(stats.avgConfidence).toBeCloseTo(0.8, 1);
    });
});
