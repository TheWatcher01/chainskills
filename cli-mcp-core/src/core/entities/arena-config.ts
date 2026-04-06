/**
 * Arena entities — blind comparison voting between LLM models.
 *
 * Pure value objects, zero external dependencies.
 *
 * @module core/entities/arena-config
 */

/** A single vote from a human judge in the arena. */
export interface ArenaVote {
    /** Round index (0-based). */
    readonly roundIndex: number;
    /** Actual model behind Candidate A. */
    readonly modelA: string;
    /** Actual model behind Candidate B. */
    readonly modelB: string;
    /** Output from model A. */
    readonly outputA: Record<string, unknown>;
    /** Output from model B. */
    readonly outputB: Record<string, unknown>;
    /** Human vote: A won, B won, or tie. */
    readonly winner: 'A' | 'B' | 'tie';
    /** Optional reason for the vote. */
    readonly reason?: string;
    /** Timestamp of the vote. */
    readonly timestamp: string;
}

/** Complete arena report with Elo ratings. */
export interface ArenaReport {
    /** Workflow used for comparison. */
    readonly workflow: string;
    /** All models that participated. */
    readonly models: readonly string[];
    /** Total rounds played. */
    readonly totalRounds: number;
    /** All votes cast. */
    readonly votes: readonly ArenaVote[];
    /** Final Elo ratings per model. */
    readonly eloRatings: Record<string, number>;
    /** Win/loss/tie stats per model. */
    readonly stats: Record<string, {
        readonly wins: number;
        readonly losses: number;
        readonly ties: number;
    }>;
    /** Report timestamp. */
    readonly timestamp: string;
}
