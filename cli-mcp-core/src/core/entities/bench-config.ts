/**
 * Bench configuration entities — types for benchmarking and golden file comparison.
 *
 * Pure value objects, zero external dependencies.
 *
 * @module core/entities/bench-config
 */

/** Golden file — expected outputs and assertions for comparison. */
export interface GoldenFile {
    /** Expected output values (exact match). */
    readonly outputs: Record<string, unknown>;
    /** Optional assertions for flexible validation. */
    readonly assertions?: {
        /** Numeric range checks: key → [min, max]. */
        readonly ranges?: Record<string, readonly [number, number]>;
        /** Type checks: key → expected typeof. */
        readonly types?: Record<string, string>;
        /** Regex pattern checks: key → pattern string. */
        readonly patterns?: Record<string, string>;
    };
}

/** Result of a single benchmark run. */
export interface BenchRunResult {
    /** Model used for this run. */
    readonly model: string;
    /** Run index (0-based). */
    readonly runIndex: number;
    /** Execution duration in ms. */
    readonly duration_ms: number;
    /** Whether execution succeeded. */
    readonly success: boolean;
    /** Workflow outputs. */
    readonly outputs: Record<string, unknown>;
    /** Token usage if available. */
    readonly tokens?: { readonly prompt: number; readonly completion: number };
    /** Error message if failed. */
    readonly error?: string;
    /** Golden file comparison result. */
    readonly goldenPass?: boolean;
    /** Golden file failures. */
    readonly goldenFailures?: readonly string[];
    /** Estimated cost in USD for this run. */
    readonly cost_usd?: number;
    /** Number of directive steps executed. */
    readonly reasoning_steps?: number;
    /** Number of steps that produced non-empty output. */
    readonly useful_steps?: number;
}

/** Aggregated benchmark report. */
export interface BenchReport {
    /** Workflow name. */
    readonly workflow: string;
    /** Models benchmarked. */
    readonly models: readonly string[];
    /** Runs per model. */
    readonly runsPerModel: number;
    /** Golden file path if used. */
    readonly goldenFile?: string;
    /** Per-model summary. */
    readonly summary: Record<string, {
        readonly avgDuration_ms: number;
        readonly successRate: number;
        readonly avgTokens?: number;
        readonly goldenPassRate?: number;
    }>;
    /** All individual run results. */
    readonly runs: readonly BenchRunResult[];
    /** Report generation timestamp. */
    readonly timestamp: string;
}
