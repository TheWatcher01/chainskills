/**
 * Leaderboard entities — types for the public model ranking.
 *
 * Pure value objects, zero external dependencies.
 *
 * @module core/entities/leaderboard
 */

import type { BenchDomain } from './benchmark-suite.js';

/** Score for a specific domain. */
export interface DomainScore {
    /** Elo rating within this domain. */
    readonly elo: number;
    /** Pass rate (0-1). */
    readonly passRate: number;
    /** Average tokens per task. */
    readonly avgTokens: number;
    /** Average latency (ms). */
    readonly avgLatency_ms: number;
    /** Estimated cost per task (USD). */
    readonly costPerTask_usd: number;
}

/** Single model entry on the leaderboard. */
export interface LeaderboardEntry {
    /** Model identifier. */
    readonly model: string;
    /** Provider (anthropic, openai, ollama). */
    readonly provider: string;
    /** Overall Elo rating. */
    readonly elo: number;
    /** Overall pass rate (0-1). */
    readonly passRate: number;
    /** Per-domain breakdown. */
    readonly domains: Partial<Record<BenchDomain, DomainScore>>;
    /** Average cost per task (USD). */
    readonly costPerTask_usd: number;
    /** Average latency (ms). */
    readonly avgLatency_ms: number;
    /** Total tokens consumed. */
    readonly totalTokens: number;
    /** Reliability: consistency across runs (0-1). */
    readonly reliability: number;
    /** Cost efficiency: passRate / costPerTask. */
    readonly costEfficiency: number;
    /** Pareto rank (1 = on frontier). */
    readonly paretoRank: number;
}

/** Complete leaderboard data. */
export interface LeaderboardData {
    /** Generation timestamp. */
    readonly updatedAt: string;
    /** Benchmark suite version. */
    readonly suiteVersion: string;
    /** Total workflows in suite. */
    readonly totalWorkflows: number;
    /** Entries sorted by Elo descending. */
    readonly entries: readonly LeaderboardEntry[];
    /** Metadata. */
    readonly meta: {
        readonly generatedBy: string;
        readonly domains: readonly BenchDomain[];
        readonly runsPerModel: number;
    };
}

/** Badge data for shields.io endpoint. */
export interface BadgeData {
    readonly schemaVersion: 1;
    readonly label: string;
    readonly message: string;
    readonly color: string;
}
