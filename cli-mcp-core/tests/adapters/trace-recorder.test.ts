/**
 * Tests for TraceRecorder — event listener that builds ExecutionTrace records.
 */

import { describe, it, expect } from 'vitest';
import { TraceRecorder } from '#adapters/executor/trace-recorder.js';
import type { TraceStore, TraceFilter, TraceStats } from '#core/ports/trace-store.port.js';
import type { ExecutionTrace } from '#core/entities/execution-trace.js';

/** In-memory TraceStore for testing. */
function createTestTraceStore(): TraceStore & { traces: ExecutionTrace[] } {
    const traces: ExecutionTrace[] = [];
    return {
        traces,
        append(trace) { traces.push(trace); },
        async flush() { /* noop in test */ },
        async query() { return traces; },
        async count() { return traces.length; },
        async stats() {
            return {
                total_traces: traces.length,
                total_runs: 0,
                by_status: {} as TraceStats['by_status'],
                by_directive: {},
                avg_duration_ms: 0,
                avg_confidence: 0,
                unique_workflows: 0,
            };
        },
    };
}

describe('TraceRecorder', () => {
    it('should record a trace from directive:start + directive:end events', async () => {
        const store = createTestTraceStore();
        const recorder = new TraceRecorder(store, 'run-123', 'test-workflow');

        recorder.listener({
            type: 'directive:start',
            timestamp: 1000,
            stepId: 'step-1',
            directiveType: 'call',
            raw: '@call shell.exec(echo hello)',
        });

        recorder.listener({
            type: 'directive:end',
            timestamp: 1050,
            stepId: 'step-1',
            directiveType: 'call',
            success: true,
            result: 'hello',
        });

        await recorder.finalize();

        expect(store.traces).toHaveLength(1);
        expect(store.traces[0]!.run_id).toBe('run-123');
        expect(store.traces[0]!.workflow_name).toBe('test-workflow');
        expect(store.traces[0]!.step_id).toBe('step-1');
        expect(store.traces[0]!.directive_type).toBe('call');
        expect(store.traces[0]!.duration_ms).toBe(50);
        expect(store.traces[0]!.status).toBe('ok');
        expect(store.traces[0]!.output).toBe('hello');
    });

    it('should record error status', async () => {
        const store = createTestTraceStore();
        const recorder = new TraceRecorder(store, 'run-456', 'error-workflow');

        recorder.listener({
            type: 'directive:start',
            timestamp: 2000,
            stepId: 'step-2',
            directiveType: 'agent',
            raw: '@agent copilot: "fix bug"',
        });

        recorder.listener({
            type: 'directive:end',
            timestamp: 2500,
            stepId: 'step-2',
            directiveType: 'agent',
            success: false,
        });

        await recorder.finalize();

        expect(store.traces).toHaveLength(1);
        expect(store.traces[0]!.status).toBe('error');
        expect(store.traces[0]!.duration_ms).toBe(500);
    });

    it('should record multiple traces from multiple directives', async () => {
        const store = createTestTraceStore();
        const recorder = new TraceRecorder(store, 'run-789', 'multi-workflow');

        // First directive
        recorder.listener({ type: 'directive:start', timestamp: 100, stepId: 's1', directiveType: 'call', raw: '@call 1' });
        recorder.listener({ type: 'directive:end', timestamp: 120, stepId: 's1', directiveType: 'call', success: true });

        // Second directive
        recorder.listener({ type: 'directive:start', timestamp: 130, stepId: 's2', directiveType: 'assert', raw: '@assert $x > 0' });
        recorder.listener({ type: 'directive:end', timestamp: 131, stepId: 's2', directiveType: 'assert', success: true });

        await recorder.finalize();

        expect(store.traces).toHaveLength(2);
        expect(recorder.traceCount).toBe(2);
    });

    it('should handle directive:end without matching start', async () => {
        const store = createTestTraceStore();
        const recorder = new TraceRecorder(store, 'run-orphan', 'orphan-workflow');

        recorder.listener({
            type: 'directive:end',
            timestamp: 5000,
            stepId: 'orphan',
            directiveType: 'call',
            success: true,
        });

        await recorder.finalize();

        expect(store.traces).toHaveLength(1);
        expect(store.traces[0]!.duration_ms).toBe(0);
    });

    it('should ignore non-directive events', async () => {
        const store = createTestTraceStore();
        const recorder = new TraceRecorder(store, 'run-ignore', 'ignore-workflow');

        recorder.listener({
            type: 'workflow:start',
            timestamp: 0,
            workflowName: 'test',
            totalSteps: 2,
            dryRun: false,
        });

        recorder.listener({
            type: 'step:start',
            timestamp: 10,
            stepId: 's1',
            stepTitle: 'Step 1',
            stepIndex: 0,
            totalSteps: 2,
        });

        await recorder.finalize();

        expect(store.traces).toHaveLength(0);
    });

    it('should serialize object results as JSON', async () => {
        const store = createTestTraceStore();
        const recorder = new TraceRecorder(store, 'run-obj', 'obj-workflow');

        recorder.listener({ type: 'directive:start', timestamp: 0, stepId: 's1', directiveType: 'call', raw: '@call' });
        recorder.listener({
            type: 'directive:end',
            timestamp: 10,
            stepId: 's1',
            directiveType: 'call',
            success: true,
            result: { name: 'Alice', score: 42 },
        });

        await recorder.finalize();

        expect(store.traces[0]!.output).toBe('{"name":"Alice","score":42}');
    });
});
