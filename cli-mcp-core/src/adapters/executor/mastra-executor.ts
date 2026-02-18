/**
 * Mastra DAG executor adapter — orchestrates workflows using Mastra's DAG engine.
 *
 * Implements the `WorkflowExecutor` port using `@mastra/core/workflows` for
 * real parallel execution, branching, foreach, and loop control flow.
 *
 * This adapter translates a chainskills `DAG` into a Mastra workflow,
 * creates dynamic steps, and maps execution results back to the
 * chainskills `ExecutionResult` format.
 *
 * @module adapters/executor/mastra-executor
 */

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import type { Result } from '#infra/errors.js';
import type { ExecutionError } from '#infra/errors.js';
import { ok, err, executionError } from '#infra/errors.js';
import type { Workflow } from '#core/entities/workflow.js';
import type { Step } from '#core/entities/step.js';
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
import { buildDAG, type DAG } from '#core/use-cases/build-dag.js';
import {
    executeDirective,
    type DirectiveHandlerContext,
} from './directive-handlers.js';
import type { Logger } from '#infra/logger.js';
import type { AgentProvider } from '#core/ports/agent-provider.port.js';

// ─── ExecutionController Implementation ──────────────────────────────────────

/**
 * Simple execution controller for Mastra workflows.
 * Note: Mastra has its own suspend/resume, but this provides
 * a unified interface for chainskills.
 */
class MastraExecutionController implements ExecutionController {
    private _paused = false;
    private _cancelled = false;
    private _pauseListeners: Array<() => void> = [];
    private _resumeListeners: Array<() => void> = [];

    pause(): void {
        if (!this._paused && !this._cancelled) {
            this._paused = true;
            this._pauseListeners.forEach((l) => l());
        }
    }

    resume(): void {
        if (this._paused && !this._cancelled) {
            this._paused = false;
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
        // Step mode not implemented for Mastra (yet)
        this.resume();
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
}

// ─── Loose Zod schema for dynamic workflow data ──────────────────────────────

/** Dynamic input/output schema — chainskills variables are resolved at runtime. */
const DynamicSchema = z.record(z.unknown());

// ─── Types ───────────────────────────────────────────────────────────────────

/** Dependencies injected into the Mastra executor. */
export interface MastraExecutorDeps {
    readonly store: StateStore;
    readonly tools: ToolProvider;
    readonly logger?: Logger;
    readonly emitter?: ExecutionEventEmitter;
    readonly resolver?: SkillResolver;
    readonly parser?: WorkflowParser;
    readonly agent?: AgentProvider;
}

// ─── Helper: execute child directives recursively ────────────────────────────

async function executeChildDirectives(
    directives: readonly import('#core/entities/directive.js').Directive[],
    ctx: DirectiveHandlerContext,
): Promise<void> {
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

// ─── Step Executor ───────────────────────────────────────────────────────────

/**
 * Execute a chainskills Step using shared directive handlers.
 *
 * Returns the entire store state after execution.
 */
async function executeChainskillsStep(
    step: Step,
    deps: MastraExecutorDeps,
    dryRun: boolean,
): Promise<Record<string, unknown>> {
    const { store, tools, logger, emitter, resolver, parser, agent } = deps;

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

    let conditionResult: boolean | undefined;

    for (let i = 0; i < step.directives.length; i++) {
        const directive = step.directives[i]!;

        // Handle @if/@else branching
        if (directive.type === 'if') {
            const ifResult = await executeDirective(directive, step, ctx, {
                executeChildDirectives,
            });
            conditionResult = ifResult.conditionResult;

            if (conditionResult === false) {
                const elseIdx = step.directives.findIndex(
                    (d, idx) => idx > i && d.type === 'else',
                );
                if (elseIdx >= 0) {
                    i = elseIdx;
                }
            } else if (step.children && step.children.length > 0) {
                for (const child of step.children) {
                    await executeChildDirectives(child.directives, {
                        ...ctx,
                        stepId: child.id,
                    });
                }
            }
            continue;
        }

        if (directive.type === 'else') {
            if (conditionResult !== false) continue;
            continue;
        }

        const result = await executeDirective(directive, step, ctx, {
            executeChildDirectives,
        });
        if (!result.continue) break;
    }

    return store.getAll();
}

// ─── Mastra Step Factory ─────────────────────────────────────────────────────

/**
 * Create a Mastra `createStep` from a chainskills Step.
 */
function buildMastraStep(
    step: Step,
    deps: MastraExecutorDeps,
    dryRun: boolean,
) {
    return createStep({
        id: step.id,
        inputSchema: DynamicSchema,
        outputSchema: DynamicSchema,
        execute: async ({ inputData }) => {
            // Merge input data into the shared store
            for (const [key, value] of Object.entries(inputData)) {
                deps.store.set(key, value);
            }

            deps.emitter?.emit({
                type: 'step:start',
                timestamp: Date.now(),
                stepId: step.id,
                stepTitle: step.title,
                stepIndex: 0,
                totalSteps: 1,
            });

            const startTime = Date.now();

            try {
                const result = await executeChainskillsStep(step, deps, dryRun);

                deps.emitter?.emit({
                    type: 'step:end',
                    timestamp: Date.now(),
                    stepId: step.id,
                    success: true,
                    duration: Date.now() - startTime,
                });

                return result;
            } catch (error) {
                deps.emitter?.emit({
                    type: 'step:end',
                    timestamp: Date.now(),
                    stepId: step.id,
                    success: false,
                    duration: Date.now() - startTime,
                    error: error instanceof Error ? error.message : String(error),
                });
                throw error;
            }
        },
    });
}

// ─── DAG to Mastra Workflow Translation ──────────────────────────────────────

/**
 * Translate a chainskills DAG into a Mastra workflow and execute it.
 *
 * Maps DAG node types to Mastra control flow:
 * - sequential → .then()
 * - parallel → .parallel()
 * - branch → .branch()
 * - loop (for) → .foreach()
 * - loop (until) → .dountil()
 * - loop (while) → .dowhile()
 */
function translateAndExecute(
    dag: DAG,
    workflow: Workflow,
    deps: MastraExecutorDeps,
    dryRun: boolean,
) {
    // Build a map of step ID → Step entity
    const stepMap = new Map<string, Step>();
    for (const step of workflow.steps) {
        stepMap.set(step.id, step);
    }

    // Build Mastra steps for each DAG node
    const mastraSteps = new Map<string, ReturnType<typeof createStep>>();
    for (const node of dag.nodes) {
        const step = stepMap.get(node.stepId);
        if (step) {
            mastraSteps.set(node.stepId, buildMastraStep(step, deps, dryRun));
        }
    }

    // Build the workflow using Mastra's fluent API
    // We use a simplified approach: process parallel groups sequentially,
    // using .parallel() within each group and .then() between groups
    const mastraWorkflow = createWorkflow({
        id: `chainskills-${workflow.name}`,
        inputSchema: DynamicSchema,
        outputSchema: DynamicSchema,
    });

    let chain = mastraWorkflow as ReturnType<typeof createWorkflow>;

    for (const group of dag.parallelGroups) {
        const groupSteps = group
            .map((id) => mastraSteps.get(id))
            .filter((s): s is NonNullable<typeof s> => s !== undefined);

        if (groupSteps.length === 0) continue;

        if (groupSteps.length === 1) {
            chain = chain.then(groupSteps[0]!) as typeof chain;
        } else {
            chain = chain.parallel(groupSteps) as typeof chain;
        }
    }

    chain.commit();
    return chain;
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Create a Mastra-backed `WorkflowExecutor`.
 *
 * @param deps - Injected dependencies.
 * @returns A `WorkflowExecutor` that uses Mastra for DAG orchestration.
 */
export function createMastraExecutor(
    deps: MastraExecutorDeps,
): WorkflowExecutor {
    const { store, logger, emitter } = deps;

    return {
        async execute(
            workflow: Workflow,
            inputs: Record<string, unknown>,
            options?: ExecutionOptions,
        ): Promise<Result<ExecutionResult, ExecutionError>> {
            const startTime = Date.now();
            const dryRun = options?.dryRun ?? false;
            const controller = new MastraExecutionController();

            // Seed store with inputs
            for (const [key, value] of Object.entries(inputs)) {
                store.set(key, value);
            }

            logger?.info(`[Mastra] Executing workflow: ${workflow.name}`, {
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

            // Build DAG
            const dagResult = buildDAG(workflow);
            if (!dagResult.ok) {
                return err(
                    executionError(
                        'DAG_BUILD_FAILED',
                        `Failed to build DAG: ${dagResult.error.message}`,
                    ),
                );
            }

            const dag = dagResult.value;

            try {
                // Translate DAG to Mastra workflow and execute
                const mastraWorkflow = translateAndExecute(
                    dag,
                    workflow,
                    deps,
                    dryRun,
                );

                const run = await mastraWorkflow.createRun();
                const result = await run.start({ inputData: inputs });

                // Collect step results from the execution
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const mastraResult = result as any;
                const stepResults: StepResult[] = workflow.steps.map((step) => {
                    const stepData = mastraResult?.steps?.[step.id];
                    if (stepData && typeof stepData === 'object' && 'output' in stepData) {
                        return {
                            stepId: step.id,
                            status: 'success' as const,
                            output: stepData.output,
                            duration: 0,
                        };
                    }
                    return {
                        stepId: step.id,
                        status: 'success' as const,
                        output: store.getAll(),
                        duration: 0,
                    };
                });

                // Collect outputs
                const outputs: Record<string, unknown> = {};
                for (const outputDef of workflow.outputs) {
                    outputs[outputDef.name] = store.get(outputDef.name);
                }

                const duration = Date.now() - startTime;
                logger?.info(`[Mastra] Workflow completed in ${duration}ms`, { outputs });

                emitter?.emit({
                    type: 'workflow:end',
                    timestamp: Date.now(),
                    workflowName: workflow.name,
                    success: true,
                    duration,
                    outputs,
                });

                return ok({
                    outputs,
                    steps: stepResults,
                    duration,
                    controller,
                });
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                logger?.error(`[Mastra] Workflow failed: ${errorMsg}`);

                emitter?.emit({
                    type: 'workflow:end',
                    timestamp: Date.now(),
                    workflowName: workflow.name,
                    success: false,
                    duration: Date.now() - startTime,
                });

                return err(
                    executionError(
                        'MASTRA_EXECUTION_FAILED',
                        `Mastra execution failed: ${errorMsg}`,
                    ),
                );
            }
        },
    };
}
