/**
 * Resolve imports use case.
 *
 * Resolves all `@use` directives in a workflow by loading the referenced
 * skill/workflow files through the `SkillResolver` port.
 *
 * MVP supports local file resolution (`@use ./path/to/skill.workflow.md`).
 *
 * @module core/use-cases/resolve-imports
 */

import type { Result } from '#infra/errors.js';
import type { ResolveError } from '#infra/errors.js';
import { ok, err, resolveError } from '#infra/errors.js';
import type { Workflow } from '#core/entities/workflow.js';
import type { Step } from '#core/entities/step.js';
import type { Directive } from '#core/entities/directive.js';
import type {
    SkillResolver,
    ResolvedSkill,
} from '#core/ports/skill-resolver.port.js';

/** A workflow with all `@use` imports resolved. */
export interface ResolvedWorkflow {
    readonly workflow: Workflow;
    readonly resolvedSkills: ReadonlyMap<string, ResolvedSkill>;
}

/**
 * Resolve all `@use` directives in a workflow.
 *
 * Scans every step for `@use` directives, resolves each reference through
 * the injected `SkillResolver`, and returns the workflow alongside a map
 * of resolved skills.
 *
 * @param workflow - Parsed workflow entity.
 * @param resolver - Injected skill resolver implementation.
 * @returns Resolved workflow with skill contents, or a `ResolveError`.
 */
export async function resolveImports(
    workflow: Workflow,
    resolver: SkillResolver,
): Promise<Result<ResolvedWorkflow, ResolveError>> {
    const useDirectives = collectUseDirectives(workflow.steps);
    const resolvedSkills = new Map<string, ResolvedSkill>();

    for (const directive of useDirectives) {
        const ref =
            typeof directive.args['ref'] === 'string'
                ? directive.args['ref']
                : directive.raw.replace(/^@use\s+/, '').trim();

        if (!ref) continue;

        if (resolvedSkills.has(ref)) continue; // deduplicate

        const result = await resolver.resolve(ref);
        if (!result.ok) {
            return err(
                resolveError(
                    'RESOLVE_FAILED',
                    `Failed to resolve @use "${ref}": ${result.error.message}`,
                    ref,
                ),
            );
        }

        resolvedSkills.set(ref, result.value);
    }

    return ok({ workflow, resolvedSkills });
}

/**
 * Collect all `@use` directives from a step tree.
 */
function collectUseDirectives(
    steps: readonly Step[],
): readonly Directive[] {
    const result: Directive[] = [];

    for (const step of steps) {
        for (const directive of step.directives) {
            if (directive.type === 'use') {
                result.push(directive);
            }
        }
        if (step.children) {
            result.push(...collectUseDirectives(step.children));
        }
    }

    return result;
}
