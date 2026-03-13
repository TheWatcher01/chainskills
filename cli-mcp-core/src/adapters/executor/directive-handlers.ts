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
import type { AgentProvider } from '#core/ports/agent-provider.port.js';
import { substituteVariables } from '#core/services/template-engine.js';
import { evaluateCondition } from '#core/services/condition-parser.js';
import type { Logger } from '#infra/logger.js';
import type { SchemaDefinition } from '#core/ports/schema-validator.port.js';
import { createSchemaValidator } from '#core/services/schema-validator.js';
import {
    createIsolatedContext,
    mergeContextResults,
} from '#core/services/context-isolator.js';
import type { SnapshotManager } from '#core/ports/snapshot-manager.port.js';
import type { RulesStore } from '#core/ports/rules-store.port.js';
import type { ReflectionEngine } from '#core/services/reflection-engine.js';
import { formatRulesAsContext, getApplicableRules } from '#core/services/rules-applicator.js';

// ─── Handler Context ─────────────────────────────────────────────────────────

/** Dependencies available to all directive handlers. */
export interface DirectiveHandlerContext {
    readonly store: StateStore;
    readonly tools: ToolProvider;
    readonly logger?: Logger;
    readonly emitter?: ExecutionEventEmitter;
    readonly resolver?: SkillResolver;
    readonly parser?: WorkflowParser;
    readonly agent?: AgentProvider;
    readonly dryRun: boolean;
    readonly stepId: string;
    /** Set of env var names declared in the workflow frontmatter `env: []`. */
    readonly allowedEnvVars?: ReadonlySet<string>;
    /** Output schemas declared in the workflow frontmatter for @validate. */
    readonly outputSchema?: Readonly<Record<string, SchemaDefinition>>;
    /** Snapshot manager for @snapshot/@restore directives. */
    readonly snapshots?: SnapshotManager;
    /** Current run ID for snapshot association. */
    readonly runId?: string;
    /** Rules store for @reflect directive and rule injection. */
    readonly rulesStore?: RulesStore;
    /** Reflection engine for @reflect directive. */
    readonly reflectionEngine?: ReflectionEngine;
    /** Current workflow name (for rule lookup). */
    readonly workflowName?: string;
}

/** Result of a directive handler execution. */
export interface DirectiveHandlerResult {
    /** Whether execution should continue to next directive. */
    readonly continue: boolean;
    /** Whether the block condition evaluated to true (for @if). */
    readonly conditionResult?: boolean;
    /** Captured output value. */
    readonly output?: unknown;
    /** Error message — set instead of throwing. Propagated by the dispatcher. */
    readonly error?: string;
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
        return {
            continue: false,
            error: `@call ${tool}.${method} failed: ${result.error.message}`,
        };
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
        return { continue: false, error: `@if condition error: ${evalResult.error.message}` };
    }

    ctx.logger?.debug(`@if ${condition} → ${evalResult.value}`);

    return { continue: true, conditionResult: evalResult.value };
}

/** Handle @for directive — iterate over a list with optional concurrency. */
export async function handleFor(
    directive: Directive,
    step: Step,
    ctx: DirectiveHandlerContext,
    executeChildDirectives: (directives: readonly Directive[], ctx: DirectiveHandlerContext) => Promise<void>,
): Promise<DirectiveHandlerResult> {
    const variable = String(directive.args['variable'] ?? '');
    const iterableRef = String(directive.args['iterable'] ?? '');
    const concurrency = typeof directive.args['concurrency'] === 'number'
        ? directive.args['concurrency']
        : 1;

    const varName = variable.startsWith('$') ? variable.slice(1) : variable;
    const listRef = iterableRef.startsWith('$') ? iterableRef.slice(1) : iterableRef;

    const listValue = ctx.store.get(listRef);
    const items = Array.isArray(listValue) ? listValue : [];

    ctx.logger?.info(`@for ${variable} in ${iterableRef} — ${items.length} items (concurrency: ${concurrency})`);

    // Get child directives: prefer directive.children, then step.children, then fallback
    const forIdx = step.directives.indexOf(directive);
    const childDirectives = directive.children
        ? directive.children.flatMap((c) => c.directives)
        : step.children
            ? step.children.flatMap((c) => c.directives)
            : step.directives.slice(forIdx + 1);

    if (concurrency <= 1) {
        // Sequential execution (original behavior)
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
    } else {
        // Concurrent execution with context isolation
        // Process in batches of `concurrency`
        const allResults: Record<string, unknown>[] = [];

        for (let batchStart = 0; batchStart < items.length; batchStart += concurrency) {
            const batch = items.slice(batchStart, batchStart + concurrency);

            const batchPromises = batch.map(async (item, offset) => {
                const i = batchStart + offset;
                const isolated = createIsolatedContext(ctx.store);
                isolated.store.set(varName, item);
                isolated.store.set(`${varName}_index`, i);

                ctx.emitter?.emit({
                    type: 'loop:iteration',
                    timestamp: Date.now(),
                    stepId: ctx.stepId,
                    index: i,
                    total: items.length,
                    item,
                });

                if (!ctx.dryRun) {
                    await executeChildDirectives(childDirectives, {
                        ...ctx,
                        store: isolated.store,
                        stepId: `${ctx.stepId}-iter-${i}`,
                    });
                }

                return isolated.store.getAll();
            });

            const batchResults = await Promise.allSettled(batchPromises);
            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    allResults.push(result.value);
                }
            }
        }

        // Merge all iteration results
        mergeContextResults(ctx.store, allResults);
        ctx.store.set(`${listRef}_results`, allResults);
    }

    return { continue: false };
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
    const childDirectives = directive.children
        ? directive.children.flatMap((c) => c.directives)
        : step.children
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
    // Prefer directive.children from parser, then step-level fallback
    const tryDirectives = directive.children
        ? directive.children.flatMap((c) => c.directives)
        : onErrorIdx >= 0
            ? step.directives.slice(tryIdx + 1, onErrorIdx)
            : step.children
                ? step.children.flatMap((c) => c.directives)
                : step.directives.slice(tryIdx + 1);

    // Error directives from parser or step-level fallback
    const parsedErrorChildren = directive.args['_errorChildren'] as Step[] | undefined;

    // Directives after @on-error: prefer parsed error children, then step-level
    const errorDirectives = parsedErrorChildren
        ? parsedErrorChildren.flatMap((c) => c.directives)
        : onErrorIdx >= 0
            ? step.directives.slice(onErrorIdx + 1)
            : [];

    // Auto-snapshot before @try block if snapshot manager is available
    if (ctx.snapshots && ctx.runId && !ctx.dryRun) {
        const autoLabel = `_try_${ctx.stepId}_${Date.now()}`;
        ctx.snapshots.save(ctx.runId, autoLabel, ctx.store.getAll(), ctx.stepId);
        ctx.store.set('_trySnapshotLabel', autoLabel);
        ctx.logger?.info(`@try — auto-snapshot saved: "${autoLabel}"`);
    }

    try {
        if (!ctx.dryRun) {
            await executeChildDirectives(tryDirectives, ctx);
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        ctx.logger?.warn(`@try caught error: ${errorMsg}`);
        ctx.store.set('_error', errorMsg);

        // Auto-restore state from snapshot on error
        if (ctx.snapshots && ctx.runId && !ctx.dryRun) {
            const autoLabel = ctx.store.get('_trySnapshotLabel') as string | undefined;
            if (autoLabel) {
                const snapshot = ctx.snapshots.loadByLabel(ctx.runId, autoLabel);
                if (snapshot) {
                    const currentKeys = Object.keys(ctx.store.getAll());
                    for (const key of currentKeys) {
                        ctx.store.set(key, undefined);
                    }
                    for (const [key, value] of Object.entries(snapshot.state)) {
                        ctx.store.set(key, value);
                    }
                    // Re-set error so @on-error handlers can access it
                    ctx.store.set('_error', errorMsg);
                    ctx.logger?.info(`@try — auto-restored state from "${autoLabel}"`);
                }
            }
        }

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

/** Handle @parallel directive — true parallel execution with context isolation. */
export async function handleParallel(
    directive: Directive,
    step: Step,
    ctx: DirectiveHandlerContext,
    executeChildDirectives: (directives: readonly Directive[], ctx: DirectiveHandlerContext) => Promise<void>,
): Promise<DirectiveHandlerResult> {
    const parallelChildren = directive.children ?? step.children ?? [];

    if (parallelChildren.length === 0) {
        return { continue: true };
    }

    ctx.logger?.info(`@parallel — executing ${parallelChildren.length} branches in parallel`);

    ctx.emitter?.emit({
        type: 'parallel:start',
        timestamp: Date.now(),
        stepIds: parallelChildren.map((c) => c.id),
    });

    const startTime = Date.now();

    // Create isolated context per branch and execute all in parallel
    const promises = parallelChildren.map(async (child) => {
        const isolated = createIsolatedContext(ctx.store);
        const branchCtx: DirectiveHandlerContext = {
            ...ctx,
            store: isolated.store,
            stepId: child.id,
        };

        try {
            await executeChildDirectives(child.directives, branchCtx);
            return {
                id: child.id,
                success: true as const,
                results: isolated.store.getAll(),
            };
        } catch (error) {
            return {
                id: child.id,
                success: false as const,
                error: error instanceof Error ? error.message : String(error),
                results: isolated.store.getAll(),
            };
        }
    });

    const settled = await Promise.allSettled(promises);

    // Collect results
    const results: Record<string, { success: boolean; error?: string }> = {};
    const successResults: Record<string, unknown>[] = [];
    let failureCount = 0;

    for (const outcome of settled) {
        if (outcome.status === 'fulfilled') {
            const branch = outcome.value;
            results[branch.id] = { success: branch.success, error: branch.success ? undefined : branch.error };
            if (branch.success) {
                successResults.push(branch.results);
            } else {
                failureCount++;
            }
        } else {
            failureCount++;
        }
    }

    // Merge successful branch results into parent store
    mergeContextResults(ctx.store, successResults);

    if (failureCount > 0) {
        ctx.logger?.warn(`${failureCount}/${parallelChildren.length} parallel branches failed`);
    }

    ctx.emitter?.emit({
        type: 'parallel:end',
        timestamp: Date.now(),
        results,
        duration: Date.now() - startTime,
    });

    // Continue if at least one branch succeeded
    return { continue: failureCount < parallelChildren.length };
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
        return { continue: false, error: `@assert evaluation error: ${evalResult.error.message}` };
    }

    if (!evalResult.value) {
        return { continue: false, error: `@assert failed: ${expression}` };
    }

    ctx.logger?.debug(`@assert ${expression} → passed`);
    return { continue: true };
}

/**
 * Handle @breakpoint directive — conditional pause for debugging.
 *
 * Evaluates an optional condition and logs when breakpoint is hit.
 * Future: integrate with ExecutionController to actually pause execution.
 *
 * @example
 * ```md
 * @breakpoint $retries > 3
 * @breakpoint
 * ```
 */
export function handleBreakpoint(
    directive: Directive,
    ctx: DirectiveHandlerContext,
): DirectiveHandlerResult {
    const condition = String(directive.args['condition'] ?? 'true');
    const context = ctx.store.getAll();
    const resolved = substituteVariables(condition, context);
    const evalResult = evaluateCondition(resolved, context);

    if (!evalResult.ok) {
        ctx.logger?.warn(`@breakpoint evaluation error: ${evalResult.error.message}`);
        return { continue: true }; // Don't fail execution on breakpoint errors
    }

    if (evalResult.value) {
        ctx.logger?.info(`🔴 Breakpoint hit: ${condition}`);
        ctx.emitter?.emit({
            type: 'directive:end',
            timestamp: Date.now(),
            stepId: ctx.stepId,
            directiveType: 'breakpoint',
            success: true,
            result: { condition, hit: true },
        });
        // TODO: Integrate with ExecutionController.pause() when available in context
    }

    return { continue: true };
}

/**
 * Handle @env directive — load environment variable into store.
 *
 * Security: Only variables declared in the workflow's frontmatter `env: []`
 * are accessible. Access to undeclared variables is rejected.
 */
export function handleEnv(
    directive: Directive,
    ctx: DirectiveHandlerContext,
): DirectiveHandlerResult {
    const envName = String(directive.args['name'] ?? '');

    // Security: check if this env var is declared in the workflow's env allowlist
    const allowedEnvVars = ctx.allowedEnvVars;
    if (allowedEnvVars && !allowedEnvVars.has(envName)) {
        ctx.logger?.warn(`@env ${envName} — rejected: not declared in workflow frontmatter env[]`);
        return { continue: true };
    }

    const envValue = process.env[envName];
    if (envValue !== undefined) {
        ctx.store.set(envName, envValue);
    }
    ctx.logger?.debug(`@env ${envName} = ${envValue !== undefined ? '***' : '(undefined)'}`);
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

/**
 * Handle `@agent` and `@handoff` directives — delegate tasks to an AI agent.
 *
 * - `@agent copilot: "Fix the bug in auth.ts"` → invoke agent, capture response
 * - `@handoff reviewer: "Review these changes"` → invoke agent as handoff
 *
 * The response is stored in `$agent_response` (or a custom capture variable).
 */
export async function handleAgentOrHandoff(
    directive: Directive,
    ctx: DirectiveHandlerContext,
): Promise<DirectiveHandlerResult> {
    const agentName = String(directive.args['agent'] ?? directive.args['name'] ?? 'copilot');
    const prompt = String(directive.args['prompt'] ?? directive.args['message'] ?? '');
    const capture = String(directive.args['capture'] ?? 'agent_response');

    if (!prompt) {
        return { continue: false, error: `@${directive.type}: no prompt provided` };
    }

    // In dry-run mode, just log
    if (ctx.dryRun) {
        ctx.logger?.info(`@${directive.type} ${agentName}: "${prompt.slice(0, 80)}" [dry-run]`);
        const dryResponse = `[dry-run] @${directive.type} ${agentName}: "${prompt.slice(0, 100)}"`;
        ctx.store.set(capture, dryResponse);
        return { continue: true, output: dryResponse };
    }

    // Check if agent provider is wired
    if (!ctx.agent) {
        ctx.logger?.warn(
            `@${directive.type}: no agent provider configured — set AGENT_API_KEY. Skipping.`,
            { raw: directive.raw },
        );
        return { continue: true };
    }

    // Resolve variables in prompt
    const vars = ctx.store.getAll();
    let resolvedPrompt = substituteVariables(prompt, vars);

    // Inject learned rules as context if available
    if (ctx.rulesStore && ctx.workflowName) {
        const rules = getApplicableRules(ctx.rulesStore, ctx.workflowName);
        const rulesContext = formatRulesAsContext(rules);
        if (rulesContext) {
            resolvedPrompt = resolvedPrompt + rulesContext;
            // Record rule hits
            for (const rule of rules.filter((r) => r.ruleType === 'soft')) {
                ctx.rulesStore.recordHit(rule.id);
            }
        }
    }

    // Invoke the agent
    const result = await ctx.agent.invoke({
        agent: agentName,
        prompt: resolvedPrompt,
        variables: vars,
    });

    if (!result.ok) {
        return {
            continue: false,
            error: `@${directive.type} ${agentName} failed: ${result.error.message}`,
        };
    }

    // Store response in state
    ctx.store.set(capture, result.value.content);
    ctx.logger?.info(`@${directive.type} ${agentName}: response received`, {
        model: result.value.model,
        tokens: result.value.usage?.totalTokens,
        capturedAs: `$${capture}`,
    });

    return { continue: true, output: result.value.content };
}

/**
 * Handle @team directive — execute a team of agents with dependency-aware parallelism.
 *
 * Independent agents (no variable dependencies on other agents' outputs) run in parallel.
 * Dependent agents wait for their dependencies.
 *
 * @example
 * ```md
 * @team review-team concurrency:3:
 *   @agent critic: "Find bugs in $code" → $critic_result
 *   @agent defender: "Defend the code quality of $code" → $defender_result
 *   @agent judge: "Arbitrate between $critic_result and $defender_result" → $verdict
 * ```
 */
export async function handleTeam(
    directive: Directive,
    step: Step,
    ctx: DirectiveHandlerContext,
    executeChildDirectives: (directives: readonly Directive[], ctx: DirectiveHandlerContext) => Promise<void>,
): Promise<DirectiveHandlerResult> {
    const teamName = String(directive.args['name'] ?? 'unnamed-team');
    const concurrency = typeof directive.args['concurrency'] === 'number'
        ? directive.args['concurrency']
        : 3;

    const teamChildren = directive.children ?? step.children ?? [];

    if (teamChildren.length === 0) {
        return { continue: true };
    }

    ctx.logger?.info(`@team ${teamName} — ${teamChildren.length} agents (concurrency: ${concurrency})`);

    // Extract agent directives from children
    const agentSteps = teamChildren.flatMap((child) =>
        child.directives
            .filter((d) => d.type === 'agent' || d.type === 'handoff')
            .map((d) => ({ step: child, directive: d }))
    );

    if (agentSteps.length === 0) {
        ctx.logger?.warn(`@team ${teamName} — no @agent directives found`);
        return { continue: true };
    }

    // Build dependency graph from variable references
    const { extractVariables } = await import('#core/services/template-engine.js');

    const captureMap = new Map<string, number>(); // variable name → agent index
    const deps = new Map<number, Set<number>>();   // agent index → dependencies

    for (let i = 0; i < agentSteps.length; i++) {
        const capture = String(agentSteps[i]!.directive.args['capture'] ?? '');
        if (capture) {
            captureMap.set(capture, i);
        }
        deps.set(i, new Set());
    }

    for (let i = 0; i < agentSteps.length; i++) {
        const prompt = String(agentSteps[i]!.directive.args['prompt'] ?? agentSteps[i]!.directive.args['message'] ?? '');
        const vars = extractVariables(prompt);
        for (const v of vars) {
            const depIdx = captureMap.get(v);
            if (depIdx !== undefined && depIdx !== i) {
                deps.get(i)!.add(depIdx);
            }
        }
    }

    // Execute in topological order with parallelism
    const completed = new Set<number>();
    const results: Record<string, unknown> = {};

    while (completed.size < agentSteps.length) {
        // Find ready agents (all deps completed)
        const ready: number[] = [];
        for (let i = 0; i < agentSteps.length; i++) {
            if (completed.has(i)) continue;
            const agentDeps = deps.get(i)!;
            if ([...agentDeps].every((d) => completed.has(d))) {
                ready.push(i);
            }
        }

        if (ready.length === 0) {
            ctx.logger?.error(`@team ${teamName} — circular dependency detected`);
            return { continue: false, error: `@team ${teamName}: circular dependency` };
        }

        // Execute ready agents in parallel (up to concurrency limit)
        const batch = ready.slice(0, concurrency);
        const promises = batch.map(async (idx) => {
            const agent = agentSteps[idx]!;
            const isolated = createIsolatedContext(ctx.store);

            // Inject results from completed agents
            for (const [varName, value] of Object.entries(results)) {
                isolated.store.set(varName, value);
            }

            await executeChildDirectives(
                [agent.directive],
                { ...ctx, store: isolated.store, stepId: agent.step.id },
            );

            const capture = String(agent.directive.args['capture'] ?? '');
            if (capture) {
                results[capture] = isolated.store.get(capture);
            }

            return idx;
        });

        const settled = await Promise.allSettled(promises);
        for (const outcome of settled) {
            if (outcome.status === 'fulfilled') {
                completed.add(outcome.value);
            }
        }
    }

    // Write all results to parent store
    for (const [key, value] of Object.entries(results)) {
        ctx.store.set(key, value);
    }

    return { continue: false };
}

/**
 * Handle @vote directive — launch N parallel agent calls and aggregate by majority.
 *
 * @example
 * ```md
 * @vote count:5: "Is this code secure? $code" → $verdict
 * ```
 */
export async function handleVote(
    directive: Directive,
    ctx: DirectiveHandlerContext,
): Promise<DirectiveHandlerResult> {
    const count = typeof directive.args['count'] === 'number'
        ? directive.args['count']
        : 3;
    const prompt = String(directive.args['prompt'] ?? '');
    const capture = String(directive.args['capture'] ?? 'verdict');

    if (!prompt) {
        return { continue: false, error: '@vote requires a prompt' };
    }

    if (!ctx.agent) {
        ctx.logger?.warn('@vote: no agent provider configured');
        return { continue: true };
    }

    ctx.logger?.info(`@vote count:${count} — launching ${count} parallel agent calls`);

    const vars = ctx.store.getAll();
    const resolvedPrompt = substituteVariables(prompt, vars);

    // Launch N parallel calls
    const promises = Array.from({ length: count }, async (_, i) => {
        const result = await ctx.agent!.invoke({
            agent: 'copilot',
            prompt: resolvedPrompt,
            variables: vars,
        });
        return { index: i, result };
    });

    const results = await Promise.allSettled(promises);

    // Collect successful responses
    const votes: string[] = [];
    for (const outcome of results) {
        if (outcome.status === 'fulfilled' && outcome.value.result.ok) {
            votes.push(outcome.value.result.value.content);
        }
    }

    if (votes.length === 0) {
        return { continue: false, error: '@vote: all agent calls failed' };
    }

    // Count votes (exact match)
    const voteCounts = new Map<string, number>();
    for (const vote of votes) {
        voteCounts.set(vote, (voteCounts.get(vote) ?? 0) + 1);
    }

    // Find majority
    let maxCount = 0;
    let winner = '';
    for (const [answer, answerCount] of voteCounts) {
        if (answerCount > maxCount) {
            maxCount = answerCount;
            winner = answer;
        }
    }

    const confidence = maxCount / votes.length;

    ctx.store.set(capture, {
        answer: winner,
        confidence,
        votes,
        voteCount: votes.length,
    });

    ctx.logger?.info(`@vote result: confidence=${confidence.toFixed(2)}, ${votes.length} votes`);

    return { continue: true };
}

/**
 * Handle @validate directive — validate a variable against a named schema.
 *
 * @example
 * ```md
 * @validate $result against schema:report
 * ```
 */
export function handleValidate(
    directive: Directive,
    ctx: DirectiveHandlerContext,
): DirectiveHandlerResult {
    const varRef = String(directive.args['variable'] ?? '');
    const schemaName = String(directive.args['schema'] ?? '');

    if (!varRef || !schemaName) {
        return {
            continue: false,
            error: '@validate requires: @validate $var against schema:Name',
        };
    }

    const varName = varRef.startsWith('$') ? varRef.slice(1) : varRef;
    const value = ctx.store.get(varName);

    if (value === undefined) {
        return {
            continue: false,
            error: `@validate: variable $${varName} is not defined`,
        };
    }

    // Resolve schema from outputSchema in frontmatter
    const schema = ctx.outputSchema?.[schemaName];
    if (!schema) {
        return {
            continue: false,
            error: `@validate: schema "${schemaName}" not found in outputSchema`,
        };
    }

    const validator = createSchemaValidator();
    const issues = validator.validate(value, schema);

    if (issues.length > 0) {
        const details = issues.map((i) => `${i.path}: ${i.message}`).join('; ');
        ctx.logger?.warn(`@validate $${varName} against schema:${schemaName} — FAILED: ${details}`);

        ctx.emitter?.emit({
            type: 'directive:end',
            timestamp: Date.now(),
            stepId: ctx.stepId,
            directiveType: 'validate',
            success: false,
            result: { issues },
        });

        return {
            continue: false,
            error: `@validate failed for $${varName}: ${details}`,
        };
    }

    ctx.logger?.debug(`@validate $${varName} against schema:${schemaName} — passed`);
    return { continue: true };
}

// ─── Main Dispatcher ─────────────────────────────────────────────────────────

// ─── Reflect ────────────────────────────────────────────────────────────────

/** Handle @reflect: "prompt" → $var — analyze execution and generate rules. */
async function handleReflect(
    directive: Directive,
    ctx: DirectiveHandlerContext,
): Promise<DirectiveHandlerResult> {
    const prompt = String(directive.args['prompt'] ?? '');
    const capture = String(directive.args['capture'] ?? 'reflection');

    if (!prompt) {
        return { continue: true, error: '@reflect: no prompt provided' };
    }

    if (ctx.dryRun) {
        ctx.logger?.info(`@reflect: "${prompt.slice(0, 80)}" [dry-run]`);
        ctx.store.set(capture, '[dry-run] reflection skipped');
        return { continue: true };
    }

    if (!ctx.reflectionEngine) {
        ctx.logger?.warn('@reflect: no reflection engine configured — requires agent provider');
        return { continue: true };
    }

    const variables = ctx.store.getAll();
    const error = ctx.store.get('_error') as string | undefined;

    const result = await ctx.reflectionEngine.reflect({
        prompt: substituteVariables(prompt, variables),
        variables,
        stepId: ctx.stepId,
        error,
        workflowName: ctx.workflowName,
    });

    // Store reflection result
    ctx.store.set(capture, result.summary);

    // Save learned rules to store if available
    if (ctx.rulesStore && result.rules.length > 0) {
        for (const rule of result.rules) {
            ctx.rulesStore.addRule({
                workflowName: ctx.workflowName,
                ruleType: rule.ruleType,
                condition: rule.condition,
                action: rule.action,
                source: `@reflect in ${ctx.stepId}`,
                confidence: rule.confidence,
            });
        }
        ctx.logger?.info(`@reflect: saved ${result.rules.length} learned rule(s)`);
    }

    ctx.emitter?.emit({
        type: 'reflection:complete',
        timestamp: Date.now(),
        stepId: ctx.stepId,
        summary: result.summary,
        rulesCount: result.rules.length,
        suggestionsCount: result.suggestions.length,
    });

    ctx.logger?.info(`@reflect: "${result.summary.slice(0, 100)}"`, {
        rules: result.rules.length,
        suggestions: result.suggestions.length,
    });

    return { continue: true, output: result.summary };
}

// ─── Snapshot / Restore ─────────────────────────────────────────────────────

/** Handle @snapshot "label" — save current state to persistent storage. */
function handleSnapshot(
    directive: Directive,
    ctx: DirectiveHandlerContext,
): DirectiveHandlerResult {
    const label = String(directive.args['label'] ?? directive.args['_rest'] ?? 'auto')
        .replace(/^["']|["']$/g, '');

    if (!ctx.snapshots || !ctx.runId) {
        ctx.logger?.warn('@snapshot: no snapshot manager or run ID available');
        return { continue: true };
    }

    if (ctx.dryRun) {
        ctx.logger?.info(`@snapshot "${label}" (dry run — skipped)`);
        return { continue: true };
    }

    const state = ctx.store.getAll();
    const id = ctx.snapshots.save(ctx.runId, label, state, ctx.stepId);

    ctx.logger?.info(`@snapshot "${label}" saved (id=${id})`);

    ctx.emitter?.emit({
        type: 'snapshot:created',
        timestamp: Date.now(),
        stepId: ctx.stepId,
        label,
        snapshotId: id,
    });

    return { continue: true };
}

/** Handle @restore "label" — restore state from a saved snapshot. */
function handleRestore(
    directive: Directive,
    ctx: DirectiveHandlerContext,
): DirectiveHandlerResult {
    const label = String(directive.args['label'] ?? directive.args['_rest'] ?? '')
        .replace(/^["']|["']$/g, '');

    if (!label) {
        ctx.logger?.warn('@restore: no label specified');
        return { continue: true };
    }

    if (!ctx.snapshots || !ctx.runId) {
        ctx.logger?.warn('@restore: no snapshot manager or run ID available');
        return { continue: true };
    }

    if (ctx.dryRun) {
        ctx.logger?.info(`@restore "${label}" (dry run — skipped)`);
        return { continue: true };
    }

    const snapshot = ctx.snapshots.loadByLabel(ctx.runId, label);
    if (!snapshot) {
        ctx.logger?.warn(`@restore: snapshot "${label}" not found — continuing without restore`);
        return { continue: true };
    }

    // Restore state: clear current and load snapshot
    const currentKeys = Object.keys(ctx.store.getAll());
    for (const key of currentKeys) {
        ctx.store.set(key, undefined);
    }
    for (const [key, value] of Object.entries(snapshot.state)) {
        ctx.store.set(key, value);
    }

    ctx.logger?.info(`@restore "${label}" — state restored from snapshot ${snapshot.id}`);

    ctx.emitter?.emit({
        type: 'snapshot:restored',
        timestamp: Date.now(),
        stepId: ctx.stepId,
        label,
        snapshotId: snapshot.id,
    });

    return { continue: true };
}

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

        case 'breakpoint':
            result = handleBreakpoint(directive, ctx);
            break;

        case 'env':
            result = handleEnv(directive, ctx);
            break;

        case 'use':
            result = handleUse(directive, ctx);
            break;

        case 'agent':
        case 'handoff':
            result = await handleAgentOrHandoff(directive, ctx);
            break;

        case 'validate':
            result = handleValidate(directive, ctx);
            break;

        case 'team':
            result = await handleTeam(directive, step, ctx, helpers.executeChildDirectives);
            break;

        case 'vote':
            result = await handleVote(directive, ctx);
            break;

        case 'snapshot':
            result = handleSnapshot(directive, ctx);
            break;

        case 'restore':
            result = handleRestore(directive, ctx);
            break;

        case 'reflect':
            result = await handleReflect(directive, ctx);
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
        success: !result.error,
    });

    // Propagate handler errors as exceptions for backward compatibility
    // with existing executor try/catch blocks. Handlers no longer throw directly.
    if (result.error) {
        throw new Error(result.error);
    }

    return result;
}
