/**
 * Deep code quality comparator.
 *
 * Compares two code solutions using structural metrics (no heavy AST deps).
 * Uses regex-based analysis for nesting depth, function count, LoC,
 * and optionally ESLint CLI for lint errors.
 *
 * Pure functions for metrics, adapter-layer for ESLint CLI calls.
 *
 * @module core/services/deep-comparator
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Metrics for a single code solution. */
export interface CodeMetrics {
    /** Lines of code (non-empty, non-comment). */
    readonly linesOfCode: number;
    /** Number of functions/methods/arrow functions. */
    readonly functionCount: number;
    /** Average nesting depth of braces. */
    readonly avgNestingDepth: number;
    /** Maximum nesting depth. */
    readonly maxNestingDepth: number;
    /** ESLint error count (0 if ESLint not available). */
    readonly eslintErrors: number;
    /** ESLint warning count. */
    readonly eslintWarnings: number;
    /** Estimated cyclomatic complexity (branch count). */
    readonly branchCount: number;
    /** Code duplication indicator: repeated patterns. */
    readonly duplicateLines: number;
}

/** Deep comparison report. */
export interface DeepComparisonReport {
    readonly metricsA: CodeMetrics;
    readonly metricsB: CodeMetrics;
    /** Quality score A (0-100). */
    readonly qualityScoreA: number;
    /** Quality score B (0-100). */
    readonly qualityScoreB: number;
    /** Verdict. */
    readonly verdict: 'A better' | 'B better' | 'equivalent' | 'inconclusive';
    /** Reasons for verdict. */
    readonly reasons: readonly string[];
}

// ─── Metrics Extraction ──────────────────────────────────────────────────────

/**
 * Extract code metrics from source code string.
 * Uses regex-based analysis — no AST parser needed.
 */
export function extractMetrics(source: string): CodeMetrics {
    const lines = source.split('\n');

    // LoC : lignes non-vides, non-comment
    const codeLines = lines.filter((l) => {
        const trimmed = l.trim();
        return trimmed.length > 0
            && !trimmed.startsWith('//')
            && !trimmed.startsWith('*')
            && !trimmed.startsWith('/*');
    });

    // Fonctions : function, =>, class methods
    const functionPatterns = /\bfunction\b|=>\s*[{(]|\bclass\b/g;
    const functionCount = (source.match(functionPatterns) ?? []).length;

    // Nesting depth : compter les accolades
    let currentDepth = 0;
    let maxDepth = 0;
    let totalDepth = 0;
    let depthSamples = 0;

    for (const line of lines) {
        const opens = (line.match(/{/g) ?? []).length;
        const closes = (line.match(/}/g) ?? []).length;
        currentDepth += opens;
        if (currentDepth > maxDepth) maxDepth = currentDepth;
        if (opens > 0 || closes > 0) {
            totalDepth += currentDepth;
            depthSamples++;
        }
        currentDepth -= closes;
        if (currentDepth < 0) currentDepth = 0;
    }

    const avgNesting = depthSamples > 0 ? totalDepth / depthSamples : 0;

    // Branch count : if, else, case, ?, ||, &&, catch
    const branchPatterns = /\bif\b|\belse\b|\bcase\b|\bcatch\b|\?\s*[^:]/g;
    const branchCount = (source.match(branchPatterns) ?? []).length;

    // Duplicate lines : trouver les lignes repetees (hors vides/braces)
    const meaningfulLines = codeLines
        .map((l) => l.trim())
        .filter((l) => l.length > 10 && l !== '{' && l !== '}' && l !== '});');
    const seen = new Map<string, number>();
    for (const line of meaningfulLines) {
        seen.set(line, (seen.get(line) ?? 0) + 1);
    }
    const duplicateLines = [...seen.values()].filter((c) => c > 1).reduce((s, c) => s + c - 1, 0);

    return {
        linesOfCode: codeLines.length,
        functionCount,
        avgNestingDepth: Math.round(avgNesting * 10) / 10,
        maxNestingDepth: maxDepth,
        eslintErrors: 0, // Rempli par l'adapter
        eslintWarnings: 0,
        branchCount,
        duplicateLines,
    };
}

// ─── Quality Scoring ─────────────────────────────────────────────────────────

/**
 * Compute a quality score (0-100) from metrics.
 *
 * Scoring :
 * - Base 70 points
 * - -5 per ESLint error (max -30)
 * - -2 per ESLint warning (max -10)
 * - -3 per nesting level above 3 (max -15)
 * - -1 per duplicate line (max -10)
 * - +5 if function count is reasonable (3-10 for medium code)
 * - +5 if LoC is concise relative to function count
 */
export function computeQualityScore(metrics: CodeMetrics): number {
    let score = 70;

    // ESLint penalties
    score -= Math.min(30, metrics.eslintErrors * 5);
    score -= Math.min(10, metrics.eslintWarnings * 2);

    // Nesting penalty
    const nestingPenalty = Math.max(0, metrics.avgNestingDepth - 3) * 3;
    score -= Math.min(15, nestingPenalty);

    // Duplication penalty
    score -= Math.min(10, metrics.duplicateLines);

    // Function count bonus (reasonable decomposition)
    if (metrics.functionCount >= 2 && metrics.functionCount <= 15) {
        score += 5;
    }

    // Conciseness bonus
    if (metrics.functionCount > 0) {
        const locPerFunction = metrics.linesOfCode / metrics.functionCount;
        if (locPerFunction < 30) score += 5;
    }

    // Branch complexity penalty
    if (metrics.branchCount > 15) score -= 5;

    return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Comparison ──────────────────────────────────────────────────────────────

/**
 * Compare two code solutions and produce a deep comparison report.
 */
export function deepCompare(
    sourceA: string,
    sourceB: string,
    eslintA?: { errors: number; warnings: number },
    eslintB?: { errors: number; warnings: number },
): DeepComparisonReport {
    const rawA = extractMetrics(sourceA);
    const rawB = extractMetrics(sourceB);

    // Inject ESLint results if provided
    const metricsA: CodeMetrics = eslintA
        ? { ...rawA, eslintErrors: eslintA.errors, eslintWarnings: eslintA.warnings }
        : rawA;
    const metricsB: CodeMetrics = eslintB
        ? { ...rawB, eslintErrors: eslintB.errors, eslintWarnings: eslintB.warnings }
        : rawB;

    const qualityScoreA = computeQualityScore(metricsA);
    const qualityScoreB = computeQualityScore(metricsB);

    // Build reasons
    const reasons: string[] = [];

    if (metricsA.eslintErrors !== metricsB.eslintErrors) {
        reasons.push(`ESLint: A=${metricsA.eslintErrors} errors, B=${metricsB.eslintErrors} errors`);
    }
    if (Math.abs(metricsA.avgNestingDepth - metricsB.avgNestingDepth) > 0.5) {
        reasons.push(`Nesting: A=${metricsA.avgNestingDepth}, B=${metricsB.avgNestingDepth}`);
    }
    if (Math.abs(metricsA.linesOfCode - metricsB.linesOfCode) > 10) {
        reasons.push(`LoC: A=${metricsA.linesOfCode}, B=${metricsB.linesOfCode}`);
    }
    if (metricsA.duplicateLines !== metricsB.duplicateLines) {
        reasons.push(`Duplicates: A=${metricsA.duplicateLines}, B=${metricsB.duplicateLines}`);
    }

    // Verdict
    const diff = qualityScoreA - qualityScoreB;
    let verdict: DeepComparisonReport['verdict'];
    if (Math.abs(diff) < 5) {
        verdict = 'equivalent';
    } else if (diff > 0) {
        verdict = 'A better';
    } else {
        verdict = 'B better';
    }

    if (reasons.length === 0) {
        verdict = 'inconclusive';
        reasons.push('No significant differences detected');
    }

    return { metricsA, metricsB, qualityScoreA, qualityScoreB, verdict, reasons };
}
