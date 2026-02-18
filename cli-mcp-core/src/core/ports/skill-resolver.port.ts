/**
 * Skill resolver port — resolves `@use` directive references.
 *
 * Implemented by `local-resolver` (MVP — reads relative path files),
 * and later by `git-resolver` and `registry-resolver`.
 *
 * @module core/ports/skill-resolver
 */

import type { Result } from '#infra/errors.js';
import type { ResolveError } from '#infra/errors.js';

/** A successfully resolved skill/workflow reference. */
export interface ResolvedSkill {
    /** Display name of the resolved skill. */
    readonly name: string;
    /** Source reference (file path, git URL, registry ref). */
    readonly source: string;
    /** Raw content of the resolved `.workflow.md` file. */
    readonly content: string;
}

/**
 * Resolves a skill reference (from `@use` directives) to its content.
 */
export interface SkillResolver {
    /** Resolve a skill reference string to its content. */
    resolve(ref: string): Promise<Result<ResolvedSkill, ResolveError>>;
}
