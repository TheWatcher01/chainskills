/**
 * Tests for TraceHook — hook that records step-level ExecutionTraces.
 */

import { describe, it, expect, vi } from 'vitest';
import { createTraceHook } from '#adapters/hooks/trace-hook.js';
import type { TraceStore, TraceStats } from '#core/ports/trace-store.port.js';
import type { ExecutionTrace } from '#core/entities/execution-trace.js';
import type { ExecutionContext } from '#core/ports/execution-hook.port.js';
import type { Step } from '#core/entities/step.js';
import type { StepResult, ExecutionResult } from '#core/ports/workflow-executor.port.js';
import type { Workflow } from '#core/entities/workflow.js';

function createTestStore(): TraceStore & { traces: ExecutionTrace[]; flushed: boolean } {
    const traces: ExecutionTrace[] = [];
    return {
        traces,
        flushed: false,
        append(trace) { traces.push(trace); },
        async flush() { (this as { flushed: boolean }).flushed = true; },
        async query() { return traces; },
        async count() { return traces.length; },
        async stats(): Promise<TraceStats> {
            return { total_traces: traces.length, total_runs: 0, by_status: {} as TraceStats['by_status'], by_directive: {}, avg_duration_ms: 0, avg_confidence: 0, unique_workflows: 0 };
        },
    };
}

const step: Step = { id: 'step-1', title: 'Test Step', description: '', directives: [] };
const ctx: ExecutionContext = { workflowName: 'test-wf', dryRun: false, variables: { x: 1 } };

describe('createTraceHook', () => {
    it('returns continue on beforeStep', async () => {
        const store = createTestStore();
        const hook = createTraceHook({ store, runId: 'run-1' });
        const result = await hook.beforeStep!(step, ctx);
        expect(result.action).toBe('continue');
    });

    it('appends a success trace on afterStep', async () => {
        const store = createTestStore();
        const hook = createTraceHook({ store, runId: 'run-1' });

        await hook.beforeStep!(step, ctx);
        const stepResult: StepResult = { stepId: 'step-1', status: 'success', output: 'hello', duration: 42 };
        const result = await hook.afterStep!(step, stepResult, ctx);

        expect(result.action).toBe('continue');
        expect(store.traces).toHaveLength(1);
        const trace = store.traces[0]!;
        expect(trace.run_id).toBe('run-1');
        expect(trace.workflow_name).toBe('test-wf');
        expect(trace.step_id).toBe('step-1');
        expect(trace.status).toBe('ok');
        expect(trace.input).toBe('Test Step');
        expect(trace.output).toBe('hello');
        expect(trace.duration_ms).toBe(42);
    });

    it('sets status=skip for skipped steps', async () => {
        const store = createTestStore();
        const hook = createTraceHook({ store, runId: 'run-1' });

        await hook.beforeStep!(step, ctx);
        const stepResult: StepResult = { stepId: 'step-1', status: 'skipped', duration: 0 };
        await hook.afterStep!(step, stepResult, ctx);

        expect(store.traces[0]!.status).toBe('skip');
    });

    it('sets status=error for failed steps', async () => {
        const store = createTestStore();
        const hook = createTraceHook({ store, runId: 'run-1' });

        await hook.beforeStep!(step, ctx);
        const stepResult: StepResult = { stepId: 'step-1', status: 'failure', error: 'oops', duration: 10 };
        await hook.afterStep!(step, stepResult, ctx);

        expect(store.traces[0]!.status).toBe('error');
        expect(store.traces[0]!.error).toBe('oops');
    });

    it('includes variables_snapshot in trace', async () => {
        const store = createTestStore();
        const hook = createTraceHook({ store, runId: 'run-1' });

        await hook.beforeStep!(step, ctx);
        await hook.afterStep!(step, { stepId: 'step-1', status: 'success', duration: 1 }, ctx);

        expect(store.traces[0]!.variables_snapshot).toEqual({ x: 1 });
    });

    it('appends error trace on onError', async () => {
        const store = createTestStore();
        const hook = createTraceHook({ store, runId: 'run-1' });

        await hook.onError!(step, 'something failed', ctx);

        expect(store.traces).toHaveLength(1);
        expect(store.traces[0]!.status).toBe('error');
        expect(store.traces[0]!.error).toBe('something failed');
    });

    it('flushes store on afterWorkflow', async () => {
        const store = createTestStore();
        const hook = createTraceHook({ store, runId: 'run-1' });

        const workflow = { name: 'test-wf', description: '', version: '1.0.0', steps: [], inputs: [], outputs: [], env: [], tags: [], metadata: {} } as Workflow;
        const execResult: ExecutionResult = { outputs: {}, steps: [], duration: 100, controller: {} as ExecutionResult['controller'] };

        await hook.afterWorkflow!(workflow, execResult, ctx);

        expect(store.flushed).toBe(true);
    });

    it('respects custom priority', () => {
        const store = createTestStore();
        const hook = createTraceHook({ store, runId: 'run-1', priority: 99 });
        expect(hook.priority).toBe(99);
    });

    it('uses default priority 10', () => {
        const store = createTestStore();
        const hook = createTraceHook({ store, runId: 'run-1' });
        expect(hook.priority).toBe(10);
    });
});
