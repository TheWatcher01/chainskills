/**
 * Shared directive handlers — factorized execution logic for all directive types.
 *
 * Used by both `SimpleExecutor` and `MastraExecutor` to handle individual
 * directives within a step. This module is the single source of truth for
 * directive execution semantics.
 *
 * @module adapters/executor/directive-handlers
 */

import type { Directive } from '#core/entities/directive.js';
import type { Step } from '#core/entities/step.js';
import type { StateStore } from '#core/ports/state-store.port.js';
import type { ToolProvider } from '#core/ports/tool-provider.port.js';
import type { SkillResolver } from '#core/ports/skill-resolver.port.js';
import type { WorkflowParser } from '#core/ports/workflow-parser.port.js';
import type { ExecutionEventEmitter } from '#core/ports/execution-events.port.js';
import { substituteVariables } from '#core/services/template-engine.js';
import { evaluateCondition } from '#core/services/condition-parser.js';
import type { Logger } from '#infra/logger.js';

// ─── Handler Context ─────────────────────────────────────────────────────────

/** Dependencies available to all directive handlers. */
export interface DirectiveHandlerContext {
    readonly store: StateStore;
    readonly tools: ToolProvider;
    readonly logger?: Logger;
    readonly emitter?: ExecutionEventEmitter;
    readonly resolver?: SkillResolver;
    readonly parser?: WorkflowParser;
    readonly dryRun: boolean;
    readonly stepId: string;
}

/** Result of a directive handler execution. */
export interface DirectiveHandlerResult {
    /** Whether execution should continue to next directive. */
    readonly continue: boolean;
    /** Whether the block condition evaluated to true (for @if). */
    readonly conditionResult?: boolean;
    /** Captured output value. */
    readonly output?: unknown;
}

// ─── Individual Handlers ─────────────────────────────────────────────────────

/** Handle @call directive — invoke a tool with optional capture. */
export async function handleCall(
    directive: Directive,
    ctx: DirectiveHandlerContext,
): Promise<DirectiveHandlerResult> {
    const context = ctx.store.getAll();
    const tool = String(directive.args['tool'] ?? '');
    const method = String(directive.args['method'] ?? '');
    const rawInput = String(directive.args['input'] ?? '');
    const capture = String(directive.args['capture'] ?? '');

    const resolvedInput = substituteVariables(rawInput, context);

    ctx.emitter?.emit({
        type: 'directive:start',
        timestamp: Date.now(),
        stepId: ctx.stepId,
        directiveType: 'call',
        raw: directive.raw,
    });

    if (ctx.dryRun) {
        ctx.logger?.info(`[dry-run] @call ${tool}.${method}(${resolvedInput})`);
        if (capture) {
            ctx.store.set(capture, `[dry-run result of ${tool}.${method}]`);
        }
        ctx.emitter?.emit({
            type: 'directive:end',
            timestamp: Date.now(),
            stepId: ctx.stepId,
            directiveType: 'call',
            success: true,
        });
        return { continue: true };
    }

    const result = await ctx.tools.call(tool, method, {
        command: resolvedInput,
        input: resolvedInput,
    });

    if (result.ok) {
        if (capture) {
            ctx.store.set(capture, result.value);
        }
        ctx.logger?.debug(`@call ${tool}.${method} → success`);
        ctx.emitter?.emit({
            type: 'directive:end',
            timestamp: Date.now(),
            stepId: ctx.stepId,
            directiveType: 'call',
            success: true,
            result: result.value,
        });
        return { continue: true, output: result.value };
    } else {
        ctx.emitter?.emit({
            type: 'directive:end',
            timestamp: Date.now(),
            stepId: ctx.stepId,
            directiveType: 'call',
            success: false,
        });
        throw new Error(
            `@call ${tool}.${method} failed: ${result.error.message}`,
        );
    }
}

/** Handle @if directive — evaluate condition and return branch result. */
export async function handleIf(
    directive: Directive,
    ctx: DirectiveHandlerContext,
): Promise<DirectiveHandlerResult> {
    const context = ctx.store.getAll();
    const condition = String(directive.args['condition'] ?? '');
    const resolvedCondition = substituteVariables(condition, context);
    const evalResult = evaluateCondition(resolvedCondition, context);

    if (!evalResult.ok) {
        throw new Error(`@if condition error: ${evalResult.error.message}`);
    }

    ctx.logger?.debug(`@if ${condition} → ${evalResult.value}`);

    return { continue: true, conditionResult: evalResult.value };
}

/** Handle @for directive — iterate over a list in the store. */
export async function handleFor(
    directive: Directive,
    step: Step,
    ctx: DirectiveHandlerContext,
    executeChildDirectives: (directives: readonly Directive[], ctx: DirectiveHandlerContext) => Promise<void>,
): Promise<DirectiveHandlerResult> {
    const variable = String(directive.args['variable'] ?? '');
    const iterableRef = String(directive.args['iterable'] ?? '');

    const varName = variable.startsWith('$') ? variable.slice(1) : variable;
    const listRef = iterableRef.startsWith('$') ? iterableRef.slice(1) : iterableRef;

    const listValue = ctx.store.get(listRef);
    const items = Array.isArray(listValue) ? listValue : [];

    ctx.logger?.info(`@for ${variable} in ${iterableRef} — ${items.length} items`);

    // Get child directives (directives after @for in the same step)
    const forIdx = step.directives.indexOf(directive);
    const childDirectives = step.children
        ? step.children.flatMap((c) => c.directives)
        : step.directives.slice(forIdx + 1);

    const results: unknown[] = [];
    for (let i = 0; i < items.length; i++) {
        ctx.store.set(varName, items[i]);
        ctx.store.set(`${varName}_index`, i);

        ctx.emitter?.emit({
            type: 'loop:iteration',
            timestamp: Date.now(),
            stepId: ctx.stepId,
            index: i,
            total: items.length,
            item: items[i],
        });

        if (!ctx.dryRun) {
            await executeChildDirectives(childDirectives, ctx);
        }
        results.push(ctx.store.getAll());
    }

    ctx.store.set(`${listRef}_results`, results);

    return { continue: false }; // Don't process remaining directives
}

/** Handle @repeat directive — loop until condition or max iterations. */
export async function handleRepeat(
    directive: Directive,
    step: Step,
    ctx: DirectiveHandlerContext,
    executeChildDirectives: (directives: readonly Directive[], ctx: DirectiveHandlerContext) => Promise<void>,
): Promise<DirectiveHandlerResult> {
    const max = typeof directive.args['max'] === 'number'
        ? directive.args['max']
        : 10;
    const untilCondition = String(directive.args['until'] ?? '');

    ctx.logger?.info(`@repeat max:${max} until ${untilCondition}`);

    const repeatIdx = step.directives.indexOf(directive);
    const childDirectives = step.children
        ? step.children.flatMap((c) => c.directives)
        : step.directives.slice(repeatIdx + 1);

    for (let i = 0; i < max; i++) {
        ctx.store.set('_iteration', i);

        ctx.emitter?.emit({
            type: 'loop:iteration',
            timestamp: Date.now(),
            stepId: ctx.stepId,
            index: i,
            total: max,
        });

        if (!ctx.dryRun) {
            await executeChildDirectives(childDirectives, ctx);
        }

        // Check until condition
        if (untilCondition) {
            const context = ctx.store.getAll();
            const resolved = substituteVariables(untilCondition, context);
            const result = evaluateCondition(resolved, context);
            if (result.ok && result.value) {
                ctx.logger?.debug(`@repeat until condition met at iteration ${i}`);
                break;
            }
        }
    }

    return { continue: false };
}

/** Handle @try directive — wrap execution with error handling. */
export async function handleTry(
    directive: Directive,
    step: Step,
    ctx: DirectiveHandlerContext,
    executeChildDirectives: (directives: readonly Directive[], ctx: DirectiveHandlerContext) => Promise<void>,
): Promise<DirectiveHandlerResult> {
    ctx.logger?.info(`@try — entering error-protected block`);

    const tryIdx = step.directives.indexOf(directive);
    const onErrorIdx = step.directives.findIndex(
        (d, i) => i > tryIdx && d.type === 'on-error',
    );

    // Directives between @try and @on-error (or end)
    const tryDirectives = onErrorIdx >= 0
        ? step.directives.slice(tryIdx + 1, onErrorIdx)
        : step.children
            ? step.children.flatMap((c) => c.directives)
            : step.directives.slice(tryIdx + 1);

    // Directives after @on-error
    const errorDirectives = onErrorIdx >= 0
        ? step.directives.slice(onErrorIdx + 1)
        : [];

    try {
        if (!ctx.dryRun) {
            await executeChildDirectives(tryDirectives, ctx);
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        ctx.logger?.warn(`@try caught error: ${errorMsg}`);
        ctx.store.set('_error', errorMsg);

        ctx.emitter?.emit({
            type: 'error',
            timestamp: Date.now(),
            stepId: ctx.stepId,
            message: errorMsg,
        });

        // Parse @on-error action
        if (onErrorIdx >= 0) {
            const onErrorDirective = step.directives[onErrorIdx]!;
            const action = String(onErrorDirective.args['action'] ?? onErrorDirective.raw)
                .replace(/^@on-error:\s*/, '')
                .trim()
                .toLowerCase();

            if (action.includes('abort')) {
                throw error;
            }

            if (action.includes('retry')) {
                ctx.logger?.info('@on-error: retrying...');
                await executeChildDirectives(tryDirectives, ctx);
                return { continue: false };
            }

            // Default: log and continue
            ctx.logger?.info(`@on-error: ${action}`);
            if (errorDirectives.length > 0) {
                await executeChildDirectives(errorDirectives, ctx);
            }
        }
    }

    return { continue: false };
}

/** Handle @parallel directive — in SimpleExecutor, runs sequentially. */
export async function handleParallel(
    _directive: Directive,
    step: Step,
    ctx: DirectiveHandlerContext,
    executeChildDirectives: (directives: readonly Directive[], ctx: DirectiveHandlerContext) => Promise<void>,
): Promise<DirectiveHandlerResult> {
    ctx.logger?.info(`@parallel — executing children sequentially (SimpleExecutor)`);

    ctx.emitter?.emit({
        type: 'parallel:start',
        timestamp: Date.now(),
        stepIds: step.children?.map((c) => c.id) ?? [],
    });

    const startTime = Date.now();
    const results: Record<string, { success: boolean; error?: string }> = {};

    if (step.children && step.children.length > 0) {
        for (const child of step.children) {
            try {
                await executeChildDirectives(child.directives, {
                    ...ctx,
                    stepId: child.id,
                });
                results[child.id] = { success: true };
            } catch (error) {
                results[child.id] = {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        }
    }

    ctx.emitter?.emit({
        type: 'parallel:end',
        timestamp: Date.now(),
        results,
        duration: Date.now() - startTime,
    });

    return { continue: false };
}

/** Handle @workflow directive — resolve and execute sub-workflow. */
export async function handleWorkflow(
    directive: Directive,
    ctx: DirectiveHandlerContext,
    executeWorkflow?: (
        source: string,
        inputs: Record<string, unknown>,
    ) => Promise<void>,
): Promise<DirectiveHandlerResult> {
    const ref = String(directive.args['ref'] ?? directive.raw.replace(/^@workflow\s+/, '').replace(/:$/, '').trim());
    ctx.logger?.info(`@workflow ${ref} — resolving sub-workflow`);

    if (ctx.dryRun) {
        ctx.logger?.info(`[dry-run] @workflow ${ref}`);
        return { continue: true };
    }

    if (ctx.resolver && ctx.parser && executeWorkflow) {
        const resolved = await ctx.resolver.resolve(ref);
        if (resolved.ok) {
            await executeWorkflow(resolved.value.content, ctx.store.getAll());
            return { continue: true };
        } else {
            ctx.logger?.warn(`@workflow ${ref} — failed to resolve: ${resolved.error.message}`);
        }
    } else {
        ctx.logger?.warn(`@workflow ${ref} — resolver/parser not available`);
    }

    return { continue: true };
}

/** Handle @output directive — declare workflow output variables. */
export function handleOutput(
    directive: Directive,
    ctx: DirectiveHandlerContext,
): DirectiveHandlerResult {
    const variables = directive.args['variables'] as string[] | undefined;
    if (variables) {
        for (const varRef of variables) {
            const name = varRef.startsWith('$') ? varRef.slice(1) : varRef;
            const value = ctx.store.get(name);
            ctx.logger?.info(`@output ${name} = ${JSON.stringify(value)}`);
        }
    }
    return { continue: true };
}

/** Handle @assert directive — validate a condition. */
export function handleAssert(
    directive: Directive,
    ctx: DirectiveHandlerContext,
): DirectiveHandlerResult {
    const context = ctx.store.getAll();
    const expression = String(directive.args['expression'] ?? '');
    const resolved = substituteVariables(expression, context);
    const evalResult = evaluateCondition(resolved, context);

    if (!evalResult.ok) {
        throw new Error(`@assert evaluation error: ${evalResult.error.message}`);
    }

    if (!evalResult.value) {
        throw new Error(`@assert failed: ${expression}`);
    }

    ctx.logger?.debug(`@assert ${expression} → passed`);
    return { continue: true };
}

/** Handle @env directive — load environment variable into store. */
export function handleEnv(
    directive: Directive,
    ctx: DirectiveHandlerContext,
): DirectiveHandlerResult {
    const envName = String(directive.args['name'] ?? '');
    const envValue = process.env[envName];
    if (envValue !== undefined) {
        ctx.store.set(envName, envValue);
    }
    ctx.logger?.debug(`@env ${envName} = ${envValue ?? '(undefined)'}`);
    return { continue: true };
}

/** Handle @use directive — import registration. */
export function handleUse(
    directive: Directive,
    ctx: DirectiveHandlerContext,
): DirectiveHandlerResult {
    const ref = String(directive.args['ref'] ?? '');
    ctx.logger?.info(`@use ${ref} — resolved (import registered)`);
    return { continue: true };
}

/** Handle @agent / @handoff directives — not implemented yet (v0.3.0). */
export function handleAgentOrHandoff(
    directive: Directive,
    ctx: DirectiveHandlerContext,
): DirectiveHandlerResult {
    ctx.logger?.warn(
        `@${directive.type} is not implemented — skipping (planned for v0.3.0)`,
        { raw: directive.raw },
    );
    return { continue: true };
}

// ─── Main Dispatcher ─────────────────────────────────────────────────────────

/**
 * Execute a single directive using the appropriate handler.
 *
 * This is the main dispatch function used by both executors.
 */
export async function executeDirective(
    directive: Directive,
    step: Step,
    ctx: DirectiveHandlerContext,
    helpers: {
        executeChildDirectives: (
            directives: readonly Directive[],
            ctx: DirectiveHandlerContext,
        ) => Promise<void>;
        executeWorkflow?: (
            source: string,
            inputs: Record<string, unknown>,
        ) => Promise<void>;
    },
): Promise<DirectiveHandlerResult> {
    ctx.emitter?.emit({
        type: 'directive:start',
        timestamp: Date.now(),
        stepId: ctx.stepId,
        directiveType: directive.type,
        raw: directive.raw,
    });

    let result: DirectiveHandlerResult;

    switch (directive.type) {
        case 'call':
            result = await handleCall(directive, ctx);
            break;

        case 'if':
            result = await handleIf(directive, ctx);
            break;

        case 'for':
            result = await handleFor(directive, step, ctx, helpers.executeChildDirectives);
            break;

        case 'repeat':
            result = await handleRepeat(directive, step, ctx, helpers.executeChildDirectives);
            break;

        case 'try':
            result = await handleTry(directive, step, ctx, helpers.executeChildDirectives);
            break;

        case 'parallel':
            result = await handleParallel(directive, step, ctx, helpers.executeChildDirectives);
            break;

        case 'workflow':
            result = await handleWorkflow(directive, ctx, helpers.executeWorkflow);
            break;

        case 'output':
            result = handleOutput(directive, ctx);
            break;

        case 'assert':
            result = handleAssert(directive, ctx);
            break;

        case 'env':
            result = handleEnv(directive, ctx);
            break;

        case 'use':
            result = handleUse(directive, ctx);
            break;

        case 'agent':
        case 'handoff':
            result = handleAgentOrHandoff(directive, ctx);
            break;

        case 'else':
        case 'on-error':
            // These are handled by their parent (@if, @try) — skip standalone
            result = { continue: true };
            break;

        default:
            ctx.logger?.warn(`Unknown directive: @${String(directive.type)}`, {
                raw: directive.raw,
            });
            result = { continue: true };
    }

    ctx.emitter?.emit({
        type: 'directive:end',
        timestamp: Date.now(),
        stepId: ctx.stepId,
        directiveType: directive.type,
        success: true,
    });

    return result;
}
