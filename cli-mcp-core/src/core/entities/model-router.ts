/**
 * Model router entities — types for intelligent model selection.
 *
 * Pure value objects, zero external dependencies.
 *
 * @module core/entities/model-router
 */

import type { BenchDifficulty } from './benchmark-suite.js';

/** Effort levels aligned with Claude Code's effort parameter. */
export type EffortLevel = 'low' | 'medium' | 'high' | 'max';

/** All known effort levels. */
export const EFFORT_LEVELS: readonly EffortLevel[] = ['low', 'medium', 'high', 'max'];

/** Model + effort combination for cascade routing. */
export interface ModelEffort {
    readonly model: string;
    readonly effort: EffortLevel;
}

/** Metrics collected per (taskType, model, effort) triple. */
export interface TaskModelMetrics {
    /** Task type identifier (e.g., 'create-function', 'refactor'). */
    readonly taskType: string;
    /** Difficulty level. */
    readonly difficulty: BenchDifficulty;
    /** Model name (e.g., 'haiku', 'sonnet', 'opus'). */
    readonly model: string;
    /** Effort level used. */
    readonly effort: EffortLevel;
    /** Total number of runs. */
    readonly runs: number;
    /** Number of passes (verify.sh exit 0). */
    readonly passCount: number;
    /** Pass rate (0-1). */
    readonly passRate: number;
    /** Average session duration (ms). */
    readonly avgDuration_ms: number;
    /** Average tokens consumed. */
    readonly avgTokens: number;
    /** Average cost (USD). */
    readonly avgCost_usd: number;
    /** Average number of tool calls. */
    readonly avgToolCalls: number;
    /** Consistency across runs: 1 - stddev(passRate). */
    readonly reliability: number;
}

/** Complete scorecard = grid of TaskModelMetrics. */
export interface ModelScorecard {
    /** Generation timestamp. */
    readonly updatedAt: string;
    /** Total runs across all models/tasks. */
    readonly totalRuns: number;
    /** Models evaluated. */
    readonly models: readonly string[];
    /** Task types found. */
    readonly taskTypes: readonly string[];
    /** Per (taskType, model) metrics. */
    readonly metrics: readonly TaskModelMetrics[];
    /** Routing recommendations per task type. */
    readonly recommendations: readonly RouteRecommendation[];
    /** Estimated total savings (%) if routing is applied. */
    readonly estimatedSavings: number;
}

/** Routing recommendation for a specific task type. */
export interface RouteRecommendation {
    /** Task type. */
    readonly taskType: string;
    /** Recommended model. */
    readonly model: string;
    /** Recommended effort level. */
    readonly effort: EffortLevel;
    /** Confidence in recommendation (0-1). */
    readonly confidence: number;
    /** Human-readable reason. */
    readonly reason: string;
    /** Fallback chain if recommended model fails. */
    readonly fallbackChain: readonly ModelEffort[];
    /** Estimated savings vs always using the most expensive model (%). */
    readonly savingsVsExpensive: number;
}

/** Router configuration. */
export interface RouterConfig {
    /** Minimum pass rate to consider a model viable (default 0.9). */
    readonly minPassRate: number;
    /** Minimum number of runs before trusting metrics (default 3). */
    readonly minRuns: number;
    /** Prefer cheaper models when quality is equal (default true). */
    readonly preferCheaper: boolean;
    /** Model+effort cascade order, cheapest first. */
    readonly cascade: readonly ModelEffort[];
}

/** Default router configuration — 2D cascade cheapest to most expensive. */
export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
    minPassRate: 0.9,
    minRuns: 3,
    preferCheaper: true,
    cascade: [
        { model: 'haiku', effort: 'low' },
        { model: 'haiku', effort: 'high' },
        { model: 'sonnet', effort: 'medium' },
        { model: 'sonnet', effort: 'high' },
        { model: 'opus', effort: 'medium' },
        { model: 'opus', effort: 'high' },
    ],
};

/** Replay task metadata (from meta.json). */
export interface TaskMeta {
    /** Task type identifier. */
    readonly taskType: string;
    /** Task category (coding, security, data...). */
    readonly category: string;
    /** Difficulty level. */
    readonly difficulty: BenchDifficulty;
    /** Expected tools to be used. */
    readonly expectedTools: readonly string[];
    /** Expected output files. */
    readonly expectedFiles: readonly string[];
    /** Complexity score (1-10). */
    readonly complexityScore: number;
}
