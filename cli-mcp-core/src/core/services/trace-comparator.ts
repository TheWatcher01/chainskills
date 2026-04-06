/**
 * Trace comparator — compares two sets of execution traces.
 *
 * Used to evaluate if a cheaper model (Haiku) can reproduce the work
 * of a more expensive model (Opus) on the same task.
 *
 * Pure functions, zero external dependencies.
 *
 * @module core/services/trace-comparator
 */

import type { ExecutionTrace } from '../entities/execution-trace.js';

/** Result of comparing two trace sets. */
export interface ComparisonReport {
    /** Number of traces in session A. */
    readonly tracesA: number;
    /** Number of traces in session B. */
    readonly tracesB: number;
    /** Tool overlap: Jaccard index (0-1). */
    readonly toolOverlap: number;
    /** Tools used in A but not B. */
    readonly toolsOnlyInA: readonly string[];
    /** Tools used in B but not A. */
    readonly toolsOnlyInB: readonly string[];
    /** File overlap: Jaccard index of files touched (0-1). */
    readonly fileOverlap: number;
    /** Success rate A vs B. */
    readonly successRateA: number;
    readonly successRateB: number;
    /** Average duration ratio (B/A). <1 means B is faster. */
    readonly durationRatio: number;
    /** Overall similarity score (0-100). */
    readonly similarityScore: number;
    /** Verdict: can the cheaper model do the job? */
    readonly verdict: 'equivalent' | 'degraded' | 'failed' | 'improved';
}

/**
 * Compare two sets of traces.
 *
 * @param a - Traces from session A (reference, e.g., Opus).
 * @param b - Traces from session B (candidate, e.g., Haiku).
 * @returns Structured comparison report.
 */
export function compareTraces(
    a: readonly ExecutionTrace[],
    b: readonly ExecutionTrace[],
): ComparisonReport {
    const toolsA = extractToolSet(a);
    const toolsB = extractToolSet(b);
    const toolOverlap = jaccardIndex(toolsA, toolsB);

    const filesA = extractFileSet(a);
    const filesB = extractFileSet(b);
    const fileOverlap = jaccardIndex(filesA, filesB);

    const successA = a.filter((t) => t.status === 'ok').length / Math.max(a.length, 1);
    const successB = b.filter((t) => t.status === 'ok').length / Math.max(b.length, 1);

    const totalDurA = a.reduce((s, t) => s + t.duration_ms, 0);
    const totalDurB = b.reduce((s, t) => s + t.duration_ms, 0);
    const durationRatio = totalDurA > 0 ? totalDurB / totalDurA : 1;

    // Similarite ponderee : 40% tools, 30% files, 20% success, 10% steps count
    const stepCountSimilarity = 1 - Math.abs(a.length - b.length) / Math.max(a.length, b.length, 1);
    const similarityScore = Math.round(
        (toolOverlap * 40 + fileOverlap * 30 + Math.min(successB / Math.max(successA, 0.01), 1) * 20 + stepCountSimilarity * 10),
    );

    // Verdict
    let verdict: ComparisonReport['verdict'];
    if (similarityScore >= 80 && successB >= successA * 0.9) {
        verdict = 'equivalent';
    } else if (similarityScore >= 80 && successB > successA) {
        verdict = 'improved';
    } else if (similarityScore >= 50) {
        verdict = 'degraded';
    } else {
        verdict = 'failed';
    }

    return {
        tracesA: a.length,
        tracesB: b.length,
        toolOverlap: Math.round(toolOverlap * 1000) / 1000,
        toolsOnlyInA: [...toolsA].filter((t) => !toolsB.has(t)),
        toolsOnlyInB: [...toolsB].filter((t) => !toolsA.has(t)),
        fileOverlap: Math.round(fileOverlap * 1000) / 1000,
        successRateA: Math.round(successA * 1000) / 1000,
        successRateB: Math.round(successB * 1000) / 1000,
        durationRatio: Math.round(durationRatio * 100) / 100,
        similarityScore,
        verdict,
    };
}

/** Extract set of unique tools used. */
function extractToolSet(traces: readonly ExecutionTrace[]): Set<string> {
    const tools = new Set<string>();
    for (const t of traces) {
        tools.add(t.directive_type);
        // Also extract tool name from input if available
        try {
            const input = JSON.parse(t.input);
            if (input.tool) tools.add(input.tool);
        } catch {
            // Ignore parse errors
        }
    }
    return tools;
}

/** Extract set of file paths touched. */
function extractFileSet(traces: readonly ExecutionTrace[]): Set<string> {
    const files = new Set<string>();
    for (const t of traces) {
        try {
            const input = JSON.parse(t.input);
            // Common patterns: file_path, path, command containing file paths
            if (input.file_path) files.add(String(input.file_path));
            if (input.path) files.add(String(input.path));
            if (input.pattern) files.add(String(input.pattern));
        } catch {
            // Ignore parse errors
        }
    }
    return files;
}

/** Jaccard similarity index between two sets. */
function jaccardIndex(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 1;
    const intersection = new Set([...a].filter((x) => b.has(x)));
    const union = new Set([...a, ...b]);
    return intersection.size / union.size;
}
