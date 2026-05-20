/**
 * Cost tracker hook — accumulates step execution statistics.
 *
 * Tracks total steps, successes, failures, and cumulative duration.
 * Designed to be extended with token-level accounting once AgentProvider
 * surfaces token usage through StepResult.
 *
 * @module adapters/hooks/cost-tracker-hook
 */

import type { ExecutionHook, ExecutionContext, HookResult } from '#core/ports/execution-hook.port.js';
import { HOOK_CONTINUE } from '#core/ports/execution-hook.port.js';
import type { Step } from '#core/entities/step.js';
import type { Workflow } from '#core/entities/workflow.js';
import type { StepResult, ExecutionResult } from '#core/ports/workflow-executor.port.js';
import type { Logger } from '#infra/logger.js';

export interface CostSummary {
    readonly workflowName: string;
    readonly totalSteps: number;
    readonly successSteps: number;
    readonly failedSteps: number;
    readonly skippedSteps: number;
    readonly totalDurationMs: number;
}

export interface CostTrackerHookConfig {
    readonly logger?: Logger;
    readonly priority?: number;
    onSummary?: (summary: CostSummary) => void;
}

/**
 * Create a hook that tracks execution statistics per workflow run.
 *
 * Logs a cost summary after each workflow completes. The `onSummary`
 * callback can be used to push metrics to an external system.
 */
export function createCostTrackerHook(config: CostTrackerHookConfig = {}): ExecutionHook {
    const { logger, priority = 20, onSummary } = config;

    let totalSteps = 0;
    let successSteps = 0;
    let failedSteps = 0;
    let skippedSteps = 0;
    let totalDurationMs = 0;

    return {
        name: 'cost-tracker-hook',
        priority,

        async afterStep(_step: Step, result: StepResult, _ctx: ExecutionContext): Promise<HookResult> {
            totalSteps++;
            totalDurationMs += result.duration;
            if (result.status === 'success') successSteps++;
            else if (result.status === 'failure') failedSteps++;
            else skippedSteps++;
            return HOOK_CONTINUE;
        },

        async afterWorkflow(workflow: Workflow, _result: ExecutionResult, _ctx: ExecutionContext): Promise<HookResult> {
            const summary: CostSummary = {
                workflowName: workflow.name,
                totalSteps,
                successSteps,
                failedSteps,
                skippedSteps,
                totalDurationMs,
            };
            logger?.info('Workflow cost summary', summary as unknown as Record<string, unknown>);
            onSummary?.(summary);
            return HOOK_CONTINUE;
        },
    };
}
