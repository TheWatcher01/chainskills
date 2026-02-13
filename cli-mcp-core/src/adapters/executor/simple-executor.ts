/**
 * Simple sequential executor adapter — build entry point for `./runtime` export.
 *
 * Implements the `WorkflowExecutor` port with sequential step execution:
 * - Iterates steps in order
 * - Substitutes `$variables` via the template engine
 * - Evaluates `@if` conditions via the condition parser
 * - Executes `@call` directives via the `ToolProvider`
 * - Stores results in the `StateStore`
 * - Supports `--dry-run` mode
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
import type { StateStore } from '#core/ports/state-store.port.js';
import type { ToolProvider } from '#core/ports/tool-provider.port.js';
import { substituteVariables } from '#core/services/template-engine.js';
import { evaluateCondition } from '#core/services/condition-parser.js';
import type { Logger } from '#infra/logger.js';

/** Dependencies injected into the executor. */
export interface SimpleExecutorDeps {
    readonly store: StateStore;
    readonly tools: ToolProvider;
    readonly logger?: Logger;
}

/**
 * Create a sequential `WorkflowExecutor`.
 *
 * @param deps - Injected dependencies (state store, tool provider, logger).
 * @returns A `WorkflowExecutor` that runs steps sequentially.
 */
export function createSimpleExecutor(
    deps: SimpleExecutorDeps,
): WorkflowExecutor {
    const { store, tools, logger } = deps;

    return {
        async execute(
            workflow: Workflow,
            inputs: Record<string, unknown>,
            options?: ExecutionOptions,
        ): Promise<Result<ExecutionResult, ExecutionError>> {
            const startTime = Date.now();
            const dryRun = options?.dryRun ?? false;
            const stepResults: StepResult[] = [];

            // Seed store with inputs
            for (const [key, value] of Object.entries(inputs)) {
                store.set(key, value);
            }

            logger?.info(`Executing workflow: ${workflow.name}`, {
                steps: workflow.steps.length,
                dryRun,
            });

            // Execute each step sequentially
            for (const step of workflow.steps) {
                const stepResult = await executeStep(
                    step,
                    store,
                    tools,
                    logger,
                    dryRun,
                );
                stepResults.push(stepResult);

                // Abort on failure (unless step is in a @try block)
                if (stepResult.status === 'failure') {
                    logger?.error(`Step "${step.id}" failed`, {
                        error: stepResult.error,
                    });
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

            return ok({ outputs, steps: stepResults, duration });
        },
    };
}

/**
 * Execute a single step.
 */
async function executeStep(
    step: Step,
    store: StateStore,
    tools: ToolProvider,
    logger: Logger | undefined,
    dryRun: boolean,
): Promise<StepResult> {
    const startTime = Date.now();

    logger?.info(`Step: ${step.title}`, { id: step.id, dryRun });

    try {
        // Process each directive in order
        for (const directive of step.directives) {
            await executeDirective(directive, store, tools, logger, dryRun);
        }

        return {
            stepId: step.id,
            status: 'success',
            output: store.getAll(),
            duration: Date.now() - startTime,
        };
    } catch (e) {
        return {
            stepId: step.id,
            status: 'failure',
            error: e instanceof Error ? e.message : String(e),
            duration: Date.now() - startTime,
        };
    }
}

/**
 * Execute a single directive within a step.
 */
async function executeDirective(
    directive: Directive,
    store: StateStore,
    tools: ToolProvider,
    logger: Logger | undefined,
    dryRun: boolean,
): Promise<void> {
    const context = store.getAll();

    switch (directive.type) {
        case 'call': {
            const tool = String(directive.args['tool'] ?? '');
            const method = String(directive.args['method'] ?? '');
            const rawInput = String(directive.args['input'] ?? '');
            const capture = String(directive.args['capture'] ?? '');

            // Substitute variables in the input
            const resolvedInput = substituteVariables(rawInput, context);

            if (dryRun) {
                logger?.info(`[dry-run] @call ${tool}.${method}(${resolvedInput})`);
                if (capture) {
                    store.set(capture, `[dry-run result of ${tool}.${method}]`);
                }
                return;
            }

            const result = await tools.call(tool, method, {
                command: resolvedInput,
                input: resolvedInput,
            });

            if (result.ok) {
                if (capture) {
                    store.set(capture, result.value);
                }
                logger?.debug(`@call ${tool}.${method} → success`);
            } else {
                throw new Error(
                    `@call ${tool}.${method} failed: ${result.error.message}`,
                );
            }
            break;
        }

        case 'if': {
            const condition = String(directive.args['condition'] ?? '');
            const resolvedCondition = substituteVariables(condition, context);
            const evalResult = evaluateCondition(resolvedCondition, context);

            if (!evalResult.ok) {
                throw new Error(
                    `@if condition error: ${evalResult.error.message}`,
                );
            }

            logger?.debug(`@if ${condition} → ${evalResult.value}`);

            if (!evalResult.value) {
                // Skip — in a full implementation, would skip to @else
                logger?.debug('Condition false — skipping block');
            }
            break;
        }

        case 'output': {
            const variables = directive.args['variables'] as string[] | undefined;
            if (variables) {
                for (const varRef of variables) {
                    const name = varRef.startsWith('$') ? varRef.slice(1) : varRef;
                    const value = store.get(name);
                    logger?.info(`@output ${name} = ${JSON.stringify(value)}`);
                }
            }
            break;
        }

        case 'assert': {
            const expression = String(directive.args['expression'] ?? '');
            const resolved = substituteVariables(expression, context);
            const evalResult = evaluateCondition(resolved, context);

            if (!evalResult.ok) {
                throw new Error(
                    `@assert evaluation error: ${evalResult.error.message}`,
                );
            }

            if (!evalResult.value) {
                throw new Error(`@assert failed: ${expression}`);
            }

            logger?.debug(`@assert ${expression} → passed`);
            break;
        }

        case 'env': {
            const envName = String(directive.args['name'] ?? '');
            const envValue = process.env[envName];
            if (envValue !== undefined) {
                store.set(envName, envValue);
            }
            logger?.debug(`@env ${envName} = ${envValue ?? '(undefined)'}`);
            break;
        }

        case 'use': {
            const ref = String(directive.args['ref'] ?? '');
            logger?.info(`@use ${ref} — resolved (import registered)`);
            // Resolution handled at a higher level by resolve-imports use case
            break;
        }

        case 'agent':
        case 'handoff': {
            // Not implemented in MVP — log and continue
            logger?.warn(
                `@${directive.type} is not implemented in MVP — skipping`,
                { raw: directive.raw },
            );
            break;
        }

        case 'parallel':
        case 'for':
        case 'repeat':
        case 'try':
        case 'on-error':
        case 'workflow':
        case 'else': {
            // Block directives — MVP handles sequentially, log intent
            logger?.info(`@${directive.type} — sequential fallback in MVP`, {
                raw: directive.raw,
            });
            break;
        }

        default: {
            logger?.warn(`Unknown directive: @${directive.type}`, {
                raw: directive.raw,
            });
        }
    }
}

// Default export for convenience
export default createSimpleExecutor;
