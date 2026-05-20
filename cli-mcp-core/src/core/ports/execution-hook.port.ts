/**
 * Execution hook port — middleware interceptors for workflow execution.
 *
 * Hooks run synchronously in priority order (ascending) before and after
 * each step and workflow. They can inspect, abort, or skip execution
 * without coupling to executor internals.
 *
 * @module core/ports/execution-hook
 */

import type { Step } from '#core/entities/step.js';
import type { Workflow } from '#core/entities/workflow.js';
import type { StepResult, ExecutionResult } from '#core/ports/workflow-executor.port.js';

/** Possible outcomes from a hook invocation. */
export type HookResult =
    | { readonly action: 'continue' }
    | { readonly action: 'skip' }
    | { readonly action: 'abort'; readonly reason: string };

/** Execution context passed to every hook. */
export interface ExecutionContext {
    /** Name of the workflow being executed. */
    readonly workflowName: string;
    /** True when running in dry-run mode. */
    readonly dryRun: boolean;
    /** Snapshot of workflow variables at hook invocation time. */
    readonly variables: Readonly<Record<string, unknown>>;
}

/**
 * Lifecycle interceptor for workflow execution.
 *
 * Implement this interface to observe or control execution at each step
 * boundary without modifying executor logic. Hooks with lower `priority`
 * values run first.
 */
export interface ExecutionHook {
    /** Unique hook name for logging and deduplication. */
    readonly name: string;
    /** Execution order — ascending (0 = first). */
    readonly priority: number;
    /** Invoked before a step begins. Return 'skip' to skip the step, 'abort' to halt the workflow. */
    beforeStep?(step: Step, ctx: ExecutionContext): Promise<HookResult>;
    /** Invoked after a step completes (success or failure). */
    afterStep?(step: Step, result: StepResult, ctx: ExecutionContext): Promise<HookResult>;
    /** Invoked before the first step of a workflow. */
    beforeWorkflow?(workflow: Workflow, ctx: ExecutionContext): Promise<HookResult>;
    /** Invoked after the last step of a workflow completes successfully. */
    afterWorkflow?(workflow: Workflow, result: ExecutionResult, ctx: ExecutionContext): Promise<HookResult>;
    /** Invoked when a step produces a failure result. */
    onError?(step: Step, error: string, ctx: ExecutionContext): Promise<HookResult>;
}

/** Sentinel continue result — avoids repeated object allocation. */
export const HOOK_CONTINUE: HookResult = { action: 'continue' };

/**
 * Run a set of hooks for a given lifecycle method.
 * Returns on the first non-continue result (abort or skip).
 */
export async function dispatchHooks(
    hooks: readonly ExecutionHook[],
    dispatch: (hook: ExecutionHook) => Promise<HookResult> | undefined,
): Promise<HookResult> {
    for (const hook of hooks) {
        const result = await dispatch(hook);
        if (result && result.action !== 'continue') return result;
    }
    return HOOK_CONTINUE;
}
