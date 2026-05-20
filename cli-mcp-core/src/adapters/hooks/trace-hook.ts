/**
 * Trace hook — records step-level ExecutionTraces via the ExecutionHook pipeline.
 *
 * Captures step timing, status, and output as structured ExecutionTrace records.
 * Flushes to the TraceStore after the workflow completes.
 *
 * @module adapters/hooks/trace-hook
 */

import type { ExecutionHook, ExecutionContext, HookResult } from '#core/ports/execution-hook.port.js';
import { HOOK_CONTINUE } from '#core/ports/execution-hook.port.js';
import type { TraceStore } from '#core/ports/trace-store.port.js';
import type { Step } from '#core/entities/step.js';
import type { Workflow } from '#core/entities/workflow.js';
import type { StepResult, ExecutionResult } from '#core/ports/workflow-executor.port.js';
import { createTrace } from '#core/entities/execution-trace.js';

export interface TraceHookConfig {
    readonly store: TraceStore;
    readonly runId: string;
    readonly priority?: number;
}

/**
 * Create a hook that records step-level traces to a TraceStore.
 *
 * Each step produces one ExecutionTrace. The store is flushed after
 * the workflow completes or on the first step failure.
 */
export function createTraceHook(config: TraceHookConfig): ExecutionHook {
    const { store, runId, priority = 10 } = config;
    const stepStartTimes = new Map<string, number>();

    return {
        name: 'trace-hook',
        priority,

        async beforeStep(step: Step, _ctx: ExecutionContext): Promise<HookResult> {
            stepStartTimes.set(step.id, Date.now());
            return HOOK_CONTINUE;
        },

        async afterStep(step: Step, result: StepResult, ctx: ExecutionContext): Promise<HookResult> {
            const startTime = stepStartTimes.get(step.id) ?? Date.now();
            stepStartTimes.delete(step.id);

            store.append(
                createTrace({
                    run_id: runId,
                    workflow_name: ctx.workflowName,
                    step_id: step.id,
                    directive_type: 'step',
                    duration_ms: result.duration,
                    status:
                        result.status === 'success' ? 'ok'
                        : result.status === 'skipped' ? 'skip'
                        : 'error',
                    input: step.title,
                    output: result.output !== undefined ? String(result.output) : '',
                    error: result.error,
                    variables_snapshot: ctx.variables,
                }),
            );
            void startTime;
            return HOOK_CONTINUE;
        },

        async onError(step: Step, error: string, ctx: ExecutionContext): Promise<HookResult> {
            const startTime = stepStartTimes.get(step.id) ?? Date.now();
            stepStartTimes.delete(step.id);

            store.append(
                createTrace({
                    run_id: runId,
                    workflow_name: ctx.workflowName,
                    step_id: step.id,
                    directive_type: 'step',
                    duration_ms: Date.now() - startTime,
                    status: 'error',
                    input: step.title,
                    output: '',
                    error,
                }),
            );
            return HOOK_CONTINUE;
        },

        async afterWorkflow(_workflow: Workflow, _result: ExecutionResult, _ctx: ExecutionContext): Promise<HookResult> {
            await store.flush();
            return HOOK_CONTINUE;
        },
    };
}
