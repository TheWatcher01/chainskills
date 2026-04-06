/**
 * Golden file loader — loads and compares workflow outputs against expected values.
 *
 * Used by `bench` and `replay` commands to validate outputs.
 *
 * @module adapters/golden/golden-loader
 */

import { readFile } from 'node:fs/promises';
import type { Result } from '#infra/errors.js';
import { ok, err, validationError } from '#infra/errors.js';
import type { ValidationError } from '#infra/errors.js';
import type { GoldenFile } from '#core/entities/bench-config.js';

/**
 * Load and parse a golden file from disk.
 */
export async function loadGoldenFile(
    path: string,
): Promise<Result<GoldenFile, ValidationError>> {
    try {
        const content = await readFile(path, 'utf-8');
        const parsed = JSON.parse(content) as GoldenFile;

        if (!parsed.outputs || typeof parsed.outputs !== 'object') {
            return err(validationError('GOLDEN_INVALID', 'Golden file must have an "outputs" object'));
        }

        return ok(parsed);
    } catch (e) {
        return err(
            validationError(
                'GOLDEN_LOAD_ERROR',
                `Failed to load golden file: ${e instanceof Error ? e.message : String(e)}`,
            ),
        );
    }
}

/** Result of comparing actual outputs against a golden file. */
export interface GoldenComparisonResult {
    readonly pass: boolean;
    readonly failures: readonly string[];
    readonly checked: number;
}

/**
 * Compare actual workflow outputs against a golden file.
 */
export function compareWithGolden(
    actual: Record<string, unknown>,
    golden: GoldenFile,
): GoldenComparisonResult {
    const failures: string[] = [];
    let checked = 0;

    // Check output values match
    for (const [key, expectedValue] of Object.entries(golden.outputs)) {
        checked++;
        const actualValue = actual[key];

        if (actualValue === undefined) {
            failures.push(`Missing output: ${key}`);
            continue;
        }

        // Deep equality via JSON serialization
        if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
            failures.push(
                `Output mismatch: ${key} — expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`,
            );
        }
    }

    // Check assertions
    if (golden.assertions) {
        // Range assertions
        if (golden.assertions.ranges) {
            for (const [key, [min, max]] of Object.entries(golden.assertions.ranges)) {
                checked++;
                const value = actual[key];
                if (typeof value !== 'number') {
                    failures.push(`Range check: ${key} is not a number (got ${typeof value})`);
                } else if (value < min || value > max) {
                    failures.push(`Range violation: ${key} = ${value} (expected [${min}, ${max}])`);
                }
            }
        }

        // Type assertions
        if (golden.assertions.types) {
            for (const [key, expectedType] of Object.entries(golden.assertions.types)) {
                checked++;
                const actualType = typeof actual[key];
                if (actualType !== expectedType) {
                    failures.push(`Type mismatch: ${key} — expected ${expectedType}, got ${actualType}`);
                }
            }
        }

        // Pattern assertions
        if (golden.assertions.patterns) {
            for (const [key, pattern] of Object.entries(golden.assertions.patterns)) {
                checked++;
                const value = String(actual[key] ?? '');
                if (!new RegExp(pattern).test(value)) {
                    failures.push(`Pattern violation: ${key} = "${value}" (expected /${pattern}/)`);
                }
            }
        }
    }

    return { pass: failures.length === 0, failures, checked };
}
