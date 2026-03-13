/**
 * Workflow integrity service — hash computation and verification.
 *
 * Computes a SHA-256 hash of a workflow's meaningful content (excluding
 * volatile fields like `runStats`). Used by the `certify` command to
 * detect tampering after validation.
 *
 * @module core/services/workflow-integrity
 */

import { createHash } from 'node:crypto';

/** Fields to exclude from hash computation (volatile/runtime data). */
const HASH_EXCLUDED_FIELDS = new Set([
    'validatedBy',
    'validatedAt',
    'validationHash',
    'runStats',
]);

/**
 * Compute a SHA-256 hash of a workflow source string, excluding volatile fields.
 *
 * Strips frontmatter fields that change independently of the workflow logic
 * (e.g. runStats, validatedAt) so the hash is stable across certifications.
 *
 * @param source - Full `.workflow.md` source string.
 * @returns Hex-encoded SHA-256 hash.
 */
export function computeWorkflowHash(source: string): string {
    // Extract frontmatter boundaries
    const fmMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);

    if (!fmMatch) {
        // No frontmatter — hash the whole file
        return createHash('sha256').update(source).digest('hex');
    }

    const frontmatterRaw = fmMatch[1]!;
    const body = source.slice(fmMatch[0].length);

    // Filter out excluded fields (including multi-line YAML blocks)
    const lines = frontmatterRaw.split('\n');
    const filteredLines: string[] = [];
    let skipping = false;

    for (const line of lines) {
        const topLevelKey = line.match(/^(\w[\w-]*):/)?.[1];
        if (topLevelKey) {
            // Top-level field — check if it should be excluded
            skipping = HASH_EXCLUDED_FIELDS.has(topLevelKey);
        } else if (skipping && line.match(/^\s+/)) {
            // Indented line under a skipped field — skip it too
            continue;
        } else if (!line.match(/^\s+/)) {
            // Non-indented, non-field line — stop skipping
            skipping = false;
        }
        if (!skipping) {
            filteredLines.push(line);
        }
    }

    const filteredContent = filteredLines.join('\n');

    const normalizedContent = `---\n${filteredContent}\n---${body}`;
    return createHash('sha256').update(normalizedContent).digest('hex');
}

/**
 * Verify that a workflow source matches its stored hash.
 *
 * @param source - Full `.workflow.md` source string.
 * @param expectedHash - The hash stored in the frontmatter.
 * @returns `true` if the hash matches, `false` if tampered.
 */
export function verifyWorkflowIntegrity(
    source: string,
    expectedHash: string,
): boolean {
    return computeWorkflowHash(source) === expectedHash;
}
