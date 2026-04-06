/**
 * Benchmark suite entities — types for running standardized benchmark suites.
 *
 * Pure value objects, zero external dependencies.
 *
 * @module core/entities/benchmark-suite
 */

import type { BenchReport, BenchRunResult } from './bench-config.js';

/** Difficulty levels for benchmark workflows. */
export type BenchDifficulty = 'easy' | 'medium' | 'hard';

/** Domains covered by the benchmark suite. */
export type BenchDomain =
    | 'coding'
    | 'data'
    | 'security'
    | 'writing'
    | 'reasoning'
    | 'tool-use';

/** All known domains. */
export const BENCH_DOMAINS: readonly BenchDomain[] = [
    'coding',
    'data',
    'security',
    'writing',
    'reasoning',
    'tool-use',
];

/** All known difficulties. */
export const BENCH_DIFFICULTIES: readonly BenchDifficulty[] = [
    'easy',
    'medium',
    'hard',
];

/** Metadata extracted from a benchmark workflow's frontmatter. */
export interface BenchWorkflowMeta {
    /** Workflow file path (absolute). */
    readonly path: string;
    /** Workflow name from frontmatter. */
    readonly name: string;
    /** Domain (coding, data, security, writing, reasoning, tool-use). */
    readonly domain: BenchDomain;
    /** Difficulty level. */
    readonly difficulty: BenchDifficulty;
    /** Short description. */
    readonly description: string;
    /** Golden file path if present. */
    readonly goldenPath?: string;
    /** Predefined inputs for reproducibility. */
    readonly inputs?: Record<string, string>;
    /** Expected output keys. */
    readonly expectedOutputs?: readonly string[];
}

/** Configuration for running a benchmark suite. */
export interface SuiteConfig {
    /** Root directory containing benchmark workflows. */
    readonly suiteDir: string;
    /** Models to benchmark. */
    readonly models: readonly string[];
    /** Number of runs per model per workflow. */
    readonly runsPerModel: number;
    /** Filter by domain (optional — run all if omitted). */
    readonly domain?: BenchDomain;
    /** Filter by difficulty (optional). */
    readonly difficulty?: BenchDifficulty;
    /** Output directory for results. */
    readonly outputDir: string;
    /** Verbose logging. */
    readonly verbose: boolean;
    /** Dry-run mode (no LLM calls). */
    readonly dryRun: boolean;
}

/** Per-model metrics across the suite. */
export interface SuiteModelMetrics {
    /** Model identifier. */
    readonly model: string;
    /** Total workflows attempted. */
    readonly totalWorkflows: number;
    /** Workflows passed (success + golden pass if applicable). */
    readonly passed: number;
    /** Average execution duration (ms). */
    readonly avgDuration_ms: number;
    /** Overall success rate (0-1). */
    readonly successRate: number;
    /** Golden pass rate (0-1), undefined if no golden files. */
    readonly goldenPassRate?: number;
    /** Total tokens used. */
    readonly totalTokens: number;
    /** Estimated cost in USD. */
    readonly estimatedCost_usd: number;
    /** Per-domain breakdown. */
    readonly domains: Record<BenchDomain, {
        readonly passed: number;
        readonly total: number;
        readonly avgDuration_ms: number;
    }>;
    /** Per-difficulty breakdown. */
    readonly difficulties: Record<BenchDifficulty, {
        readonly passed: number;
        readonly total: number;
    }>;
}

/** Result of running the full benchmark suite. */
export interface SuiteResult {
    /** Suite version. */
    readonly suiteVersion: string;
    /** Suite root directory. */
    readonly suiteDir: string;
    /** Workflows discovered. */
    readonly workflowCount: number;
    /** Workflows that matched filters. */
    readonly filteredCount: number;
    /** Models benchmarked. */
    readonly models: readonly string[];
    /** Runs per model. */
    readonly runsPerModel: number;
    /** Per-model aggregated metrics. */
    readonly modelMetrics: readonly SuiteModelMetrics[];
    /** Per-workflow bench reports. */
    readonly reports: readonly BenchReport[];
    /** All individual run results. */
    readonly runs: readonly BenchRunResult[];
    /** Suite execution start time. */
    readonly startedAt: string;
    /** Suite execution end time. */
    readonly completedAt: string;
    /** Total duration (ms). */
    readonly totalDuration_ms: number;
    /** Filters applied. */
    readonly filters: {
        readonly domain?: BenchDomain;
        readonly difficulty?: BenchDifficulty;
    };
}
