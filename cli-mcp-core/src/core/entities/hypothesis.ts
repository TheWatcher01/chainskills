/**
 * Hypothesis and exploration tree entities.
 *
 * Used by the Reflexion system to track attempted approaches,
 * avoid repeating failures, and guide exploration.
 *
 * Inspired by Reflexion (NeurIPS 2023) + LATS (ICML 2024).
 *
 * Pure value objects, zero external dependencies.
 *
 * @module core/entities/hypothesis
 */

import type { EffortLevel } from './model-router.js';

/** A single hypothesis/attempt at solving a task. */
export interface Hypothesis {
    /** Unique identifier. */
    readonly id: string;
    /** Task identifier (e.g., 'expert/01-vague-bug-report'). */
    readonly taskId: string;
    /** Model used. */
    readonly model: string;
    /** Effort level used. */
    readonly effort: EffortLevel;
    /** Short description of the approach. */
    readonly description: string;
    /** Actions taken (tool calls). */
    readonly actions: readonly string[];
    /** Files modified. */
    readonly filesModified: readonly string[];
    /** Result: pass or fail. */
    readonly result: 'pass' | 'fail';
    /** Score from verify.sh (0-100). */
    readonly score: number;
    /** Verbal reflection on why it succeeded/failed. */
    readonly reflection: string;
    /** Timestamp. */
    readonly timestamp: string;
    /** Tokens consumed. */
    readonly tokens: number;
    /** Duration (ms). */
    readonly duration_ms: number;
}

/** An exploration tree tracking all attempts on a task. */
export interface ExplorationTree {
    /** Task identifier. */
    readonly taskId: string;
    /** All hypotheses attempted, in order. */
    readonly hypotheses: readonly Hypothesis[];
    /** Best score achieved so far. */
    readonly bestScore: number;
    /** Model+effort that achieved the best score. */
    readonly bestModelEffort: string;
    /** Number of unique approaches explored. */
    readonly explored: number;
    /** Suggested unexplored areas (from file analysis). */
    readonly unexploredAreas: readonly string[];
}

/** Configuration for the explore command. */
export interface ExploreConfig {
    /** Maximum number of attempts before giving up. */
    readonly maxAttempts: number;
    /** Minimum score to consider a pass (0-100). */
    readonly passThreshold: number;
    /** Model+effort cascade to try. */
    readonly cascade: ReadonlyArray<{ model: string; effort: EffortLevel }>;
    /** Workspace root directory. */
    readonly workspaceRoot: string;
}
