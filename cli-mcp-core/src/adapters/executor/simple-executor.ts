/**
 * Simple sequential executor adapter — runs workflow steps in order.
 *
 * Implements the `WorkflowExecutor` port with sequential step execution
 * and full control flow support (@if/@else, @for, @repeat, @try/@on-error,
 * @parallel in sequential fallback mode, @workflow sub-workflows).
 *
 * Uses shared directive handlers from `directive-handlers.ts`.
 *
 * @module adapters/executor/simple-executor
 */

import type { Result } from '#infra/errors.js';
import type { ExecutionError } from '#infra/errors.js';
import {
    ok,
    err,
    executionError,
} from '#infra/errors.js';
import type { Workflow } from '#core/entities/workflow.js';
import type { Step } from '#core/entities/step.js';
import type { Directive } from '#core/entities/directive.js';
import type {
    WorkflowExecutor,
    ExecutionOptions,
    ExecutionResult,
    StepResult,
} from '#core/ports/workflow-executor.port.js';
import type { ExecutionController } from '#core/ports/execution-controller.port.js';
import type { StateStore } from '#core/ports/state-store.port.js';
import type { ToolProvider } from '#core/ports/tool-provider.port.js';
import type { SkillResolver } from '#core/ports/skill-resolver.port.js';
import type { WorkflowParser } from '#core/ports/workflow-parser.port.js';
import type { ExecutionEventEmitter } from '#core/ports/execution-events.port.js';
import {
    executeDirective,
    type DirectiveHandlerContext,
} from './directive-handlers.js';
import type { Logger } from '#infra/logger.js';
import type { AgentProvider } from '#core/ports/agent-provider.port.js';
import type { TraceStore } from '#core/ports/trace-store.port.js';
import { TraceRecorder } from './trace-recorder.js';

/**
 * Simple implementation of ExecutionController.
 * Manages pause/resume/cancel state for workflow execution.
 */
class SimpleExecutionController implements ExecutionController {
    private _paused = false;
    private _cancelled = false;
    private _pauseListeners: Array<() => void> = [];
    private _resumeListeners: Array<() => void> = [];
    private _stepMode = false;

    pause(): void {
        if (!this._paused && !this._cancelled) {
            this._paused = true;
            this._pauseListeners.forEach((l) => l());
        }
    }

    resume(): void {
        if (this._paused && !this._cancelled) {
            this._paused = false;
            this._stepMode = false;
            this._resumeListeners.forEach((l) => l());
        }
    }

    cancel(): void {
        if (!this._cancelled) {
            this._cancelled = true;
            this._paused = false;
        }
    }

    step(): void {
        if (this._paused && !this._cancelled) {
            this._stepMode = true;
            this._paused = false;
            this._resumeListeners.forEach((l) => l());
        }
    }

    isPaused(): boolean {
        return this._paused;
    }

    isCancelled(): boolean {
        return this._cancelled;
    }

    onPaused(listener: () => void): void {
        this._pauseListeners.push(listener);
    }

    onResumed(listener: () => void): void {
        this._resumeListeners.push(listener);
    }

    /** Internal: check if we should pause after step (for step mode). */
    shouldPauseAfterStep(): boolean {
        if (this._stepMode && !this._cancelled) {
            this._stepMode = false;
            this._paused = true;
            this._pauseListeners.forEach((l) => l());
            return true;
        }
        return false;
    }

    /** Internal: wait until resumed or cancelled. */
    async waitUntilResumed(): Promise<void> {
        if (!this._paused) return;
        return new Promise((resolve) => {
            const listener = () => {
                this._resumeListeners = this._resumeListeners.filter(
                    (l) => l !== listener,
                );
                resolve();
            };
            this._resumeListeners.push(listener);
        });
    }
}

/** Dependencies injected into the executor. */
export interface SimpleExecutorDeps {
    readonly store: StateStore;
    readonly tools: ToolProvider;
    readonly logger?: Logger;
    readonly emitter?: ExecutionEventEmitter;
    readonly resolver?: SkillResolver;
    readonly parser?: WorkflowParser;
    readonly agent?: AgentProvider;
    readonly traceStore?: TraceStore;
}

/**
 * Create a sequential `WorkflowExecutor`.
 *
 * @param deps - Injected dependencies (state store, tool provider, logger).
 * @returns A `WorkflowExecutor` that runs steps sequentially with full control flow.
 */
export function createSimpleExecutor(
    deps: SimpleExecutorDeps,
): WorkflowExecutor {
    const { store, tools, logger, emitter, resolver, parser, agent, traceStore } = deps;

    return {
        async execute(
            workflow: Workflow,
            inputs: Record<string, unknown>,
            options?: ExecutionOptions,
        ): Promise<Result<ExecutionResult, ExecutionError>> {
            const startTime = Date.now();
            const dryRun = options?.dryRun ?? false;

            // Wire trace recorder if traceStore available (records even in dry-run)
            const recorder = traceStore
                ? new TraceRecorder(traceStore, crypto.randomUUID(), workflow.name)
                : null;
            if (recorder && emitter) {
                emitter.on(recorder.listener);
            }
            const stepResults: StepResult[] = [];
            const controller = new SimpleExecutionController();

            // Seed store with inputs
            for (const [key, value] of Object.entries(inputs)) {
                store.set(key, value);
            }

            logger?.info(`Executing workflow: ${workflow.name}`, {
                steps: workflow.steps.length,
                dryRun,
            });

            emitter?.emit({
                type: 'workflow:start',
                timestamp: Date.now(),
                workflowName: workflow.name,
                totalSteps: workflow.steps.length,
                dryRun,
            });

            // Execute each step sequentially
            for (let i = 0; i < workflow.steps.length; i++) {
                // Check for cancellation
                if (controller.isCancelled()) {
                    logger?.warn('Workflow execution cancelled');
                    emitter?.emit({
                        type: 'workflow:end',
                        timestamp: Date.now(),
                        workflowName: workflow.name,
                        success: false,
                        duration: Date.now() - startTime,
                    });
                    return err(
                        executionError(
                            'CANCELLED',
                            'Workflow execution was cancelled',
                        ),
                    );
                }

                // Wait if paused
                if (controller.isPaused()) {
                    logger?.info('Workflow paused, waiting for resume...');
                    await controller.waitUntilResumed();
                }

                const step = workflow.steps[i]!;
                const stepResult = await executeStep(
                    step,
                    i,
                    workflow.steps.length,
                    store,
                    tools,
                    logger,
                    dryRun,
                    emitter,
                    resolver,
                    parser,
                    agent,
                );
                stepResults.push(stepResult);

                // Pause after step for step mode
                controller.shouldPauseAfterStep();

                // Abort on failure (unless step is in a @try block)
                if (stepResult.status === 'failure') {
                    logger?.error(`Step "${step.id}" failed`, {
                        error: stepResult.error,
                    });

                    emitter?.emit({
                        type: 'workflow:end',
                        timestamp: Date.now(),
                        workflowName: workflow.name,
                        success: false,
                        duration: Date.now() - startTime,
                    });

                    // Finalize traces even on failure
                    if (recorder) {
                        if (emitter) emitter.off(recorder.listener);
                        await recorder.finalize();
                    }

                    return err(
                        executionError(
                            'STEP_FAILED',
                            `Step "${step.id}" failed: ${stepResult.error ?? 'unknown error'}`,
                            step.id,
                        ),
                    );
                }
            }

            // Collect outputs
            const outputs: Record<string, unknown> = {};
            for (const outputDef of workflow.outputs) {
                outputs[outputDef.name] = store.get(outputDef.name);
            }

            const duration = Date.now() - startTime;
            logger?.info(`Workflow completed in ${duration}ms`, { outputs });

            emitter?.emit({
                type: 'workflow:end',
                timestamp: Date.now(),
                workflowName: workflow.name,
                success: true,
                duration,
                outputs,
            });

            // Finalize trace recording
            if (recorder) {
                if (emitter) emitter.off(recorder.listener);
                await recorder.finalize();
            }

            return ok({
                outputs,
                steps: stepResults,
                duration,
                controller,
            });
        },
    };
}

/**
 * Execute child directives recursively — used by block handlers.
 */
async function executeChildDirectives(
    directives: readonly Directive[],
    ctx: DirectiveHandlerContext,
): Promise<void> {
    // We need a dummy step for the dispatcher — use an inline one
    const dummyStep: Step = {
        id: ctx.stepId,
        title: '',
        description: '',
        directives,
    };

    for (const directive of directives) {
        const result = await executeDirective(directive, dummyStep, ctx, {
            executeChildDirectives,
        });
        if (!result.continue) break;
    }
}

/**
 * Execute a single step with full control flow support.
 */
async function executeStep(
    step: Step,
    stepIndex: number,
    totalSteps: number,
    store: StateStore,
    tools: ToolProvider,
    logger: Logger | undefined,
    dryRun: boolean,
    emitter?: ExecutionEventEmitter,
    resolver?: SkillResolver,
    parser?: WorkflowParser,
    agent?: AgentProvider,
): Promise<StepResult> {
    const startTime = Date.now();

    logger?.info(`Step: ${step.title}`, { id: step.id, dryRun });

    emitter?.emit({
        type: 'step:start',
        timestamp: Date.now(),
        stepId: step.id,
        stepTitle: step.title,
        stepIndex,
        totalSteps,
    });

    const ctx: DirectiveHandlerContext = {
        store,
        tools,
        logger,
        emitter,
        resolver,
        parser,
        agent,
        dryRun,
        stepId: step.id,
    };

    try {
        let skipRemaining = false;
        let conditionResult: boolean | undefined;

        for (let i = 0; i < step.directives.length; i++) {
            const directive = step.directives[i]!;

            // Handle @if/@else branching
            if (directive.type === 'if') {
                const ifResult = await executeDirective(directive, step, ctx, {
                    executeChildDirectives,
                });
                conditionResult = ifResult.conditionResult;

                // Get children from directive.children (parser) or step.children (fallback)
                const ifChildren = directive.children ?? step.children;
                const elseChildren = directive.args['_elseChildren'] as Step[] | undefined;

                if (conditionResult === false) {
                    // Condition false — execute else branch if available
                    if (elseChildren && elseChildren.length > 0) {
                        for (const child of elseChildren) {
                            await executeChildDirectives(child.directives, {
                                ...ctx,
                                stepId: child.id,
                            });
                        }
                    } else {
                        // No parsed else children — fallback to flat @else directive
                        const elseIdx = step.directives.findIndex(
                            (d, idx) => idx > i && d.type === 'else',
                        );
                        if (elseIdx >= 0) {
                            i = elseIdx;
                        } else {
                            skipRemaining = true;
                        }
                    }
                } else {
                    // Condition true — execute main children
                    if (ifChildren && ifChildren.length > 0) {
                        for (const child of ifChildren) {
                            await executeChildDirectives(child.directives, {
                                ...ctx,
                                stepId: child.id,
                            });
                        }
                    }
                    // Skip any flat @else that follows
                    const elseIdx = step.directives.findIndex(
                        (d, idx) => idx > i && d.type === 'else',
                    );
                    if (elseIdx >= 0) {
                        skipRemaining = true;
                    }
                }
                continue;
            }

            // Handle @else — only execute if previous @if was false
            if (directive.type === 'else') {
                if (conditionResult === false) {
                    // Execute remaining directives after @else
                    skipRemaining = false;
                } else {
                    // Skip @else block since @if was true
                    skipRemaining = true;
                }
                continue;
            }

            if (skipRemaining) continue;

            const result = await executeDirective(directive, step, ctx, {
                executeChildDirectives,
            });

            if (!result.continue) break;
        }

        emitter?.emit({
            type: 'step:end',
            timestamp: Date.now(),
            stepId: step.id,
            success: true,
            duration: Date.now() - startTime,
        });

        return {
            stepId: step.id,
            status: 'success',
            output: store.getAll(),
            duration: Date.now() - startTime,
        };
    } catch (e) {
        emitter?.emit({
            type: 'step:end',
            timestamp: Date.now(),
            stepId: step.id,
            success: false,
            duration: Date.now() - startTime,
            error: e instanceof Error ? e.message : String(e),
        });

        return {
            stepId: step.id,
            status: 'failure',
            error: e instanceof Error ? e.message : String(e),
            duration: Date.now() - startTime,
        };
    }
}

// Default export for convenience
export default createSimpleExecutor;
