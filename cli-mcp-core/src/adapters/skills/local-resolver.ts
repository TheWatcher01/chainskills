/**
 * Local skill resolver adapter.
 *
 * Resolves `@use` references that point to local filesystem paths
 * (e.g. `@use ./skills/code-review.workflow.md`).
 *
 * @module adapters/skills/local-resolver
 */

import { readFileSync } from 'node:fs';
import { resolve, basename, normalize } from 'node:path';
import type { Result } from '#infra/errors.js';
import type { ResolveError } from '#infra/errors.js';
import { ok, err, resolveError } from '#infra/errors.js';
import type {
    SkillResolver,
    ResolvedSkill,
} from '#core/ports/skill-resolver.port.js';

/**
 * Create a local filesystem `SkillResolver`.
 *
 * Resolves references starting with `./` or `../` relative to `basePath`.
 * Non-local references (e.g. `owner/repo@skill`) are rejected with an error
 * indicating they require the registry resolver (v0.4+).
 *
 * @param basePath - Base directory for resolving relative paths.
 * @returns A `SkillResolver` for local file references.
 */
export function createLocalResolver(basePath: string): SkillResolver {
    return {
        async resolve(ref: string): Promise<Result<ResolvedSkill, ResolveError>> {
            // Only handle local references
            if (!ref.startsWith('./') && !ref.startsWith('../')) {
                return err(
                    resolveError(
                        'NOT_LOCAL',
                        `Reference "${ref}" is not a local path. Registry resolver required (available in v0.4+).`,
                        ref,
                    ),
                );
            }

            const absolutePath = normalize(resolve(basePath, ref));
            const normalizedBase = normalize(resolve(basePath));

            // Security: prevent path traversal outside the workspace
            if (!absolutePath.startsWith(normalizedBase)) {
                return err(
                    resolveError(
                        'PATH_TRAVERSAL',
                        `Reference "${ref}" resolves outside the workspace directory. Path traversal is not allowed.`,
                        ref,
                    ),
                );
            }

            try {
                const content = readFileSync(absolutePath, 'utf-8');
                const name = basename(ref, '.workflow.md');

                return ok({
                    name,
                    source: absolutePath,
                    content,
                });
            } catch (e) {
                return err(
                    resolveError(
                        'FILE_NOT_FOUND',
                        `Cannot read "${ref}": ${e instanceof Error ? e.message : String(e)}`,
                        ref,
                    ),
                );
            }
        },
    };
}
