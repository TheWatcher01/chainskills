/**
 * Elo rating service — calculates model rankings from arena votes.
 *
 * Standard Elo rating system adapted for LLM comparison.
 * Pure functions, zero external dependencies.
 *
 * @module core/services/elo-rating
 */

/** Default starting Elo score. */
const BASE_ELO = 1500;

/** Default K-factor (sensitivity to individual results). */
const DEFAULT_K = 32;

/**
 * Initialize Elo ratings for a set of models.
 */
export function initializeElo(models: readonly string[]): Record<string, number> {
    const ratings: Record<string, number> = {};
    for (const model of models) {
        ratings[model] = BASE_ELO;
    }
    return ratings;
}

/**
 * Calculate expected score for player A against player B.
 */
export function expectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Update Elo ratings after a match.
 *
 * @param ratingA - Current rating of model A.
 * @param ratingB - Current rating of model B.
 * @param winner - 'A' if A won, 'B' if B won, 'tie' for draw.
 * @param kFactor - Sensitivity factor (default 32).
 * @returns Updated ratings for both models.
 */
export function updateElo(
    ratingA: number,
    ratingB: number,
    winner: 'A' | 'B' | 'tie',
    kFactor: number = DEFAULT_K,
): { readonly newRatingA: number; readonly newRatingB: number } {
    const eA = expectedScore(ratingA, ratingB);
    const eB = expectedScore(ratingB, ratingA);

    let scoreA: number;
    let scoreB: number;

    switch (winner) {
        case 'A':
            scoreA = 1;
            scoreB = 0;
            break;
        case 'B':
            scoreA = 0;
            scoreB = 1;
            break;
        case 'tie':
            scoreA = 0.5;
            scoreB = 0.5;
            break;
    }

    return {
        newRatingA: Math.round(ratingA + kFactor * (scoreA - eA)),
        newRatingB: Math.round(ratingB + kFactor * (scoreB - eB)),
    };
}

/**
 * Apply multiple votes to update a full Elo table.
 */
export function applyVotes(
    ratings: Record<string, number>,
    votes: readonly { readonly modelA: string; readonly modelB: string; readonly winner: 'A' | 'B' | 'tie' }[],
    kFactor: number = DEFAULT_K,
): Record<string, number> {
    const updated = { ...ratings };

    for (const vote of votes) {
        const rA = updated[vote.modelA] ?? BASE_ELO;
        const rB = updated[vote.modelB] ?? BASE_ELO;
        const { newRatingA, newRatingB } = updateElo(rA, rB, vote.winner, kFactor);
        updated[vote.modelA] = newRatingA;
        updated[vote.modelB] = newRatingB;
    }

    return updated;
}

/**
 * Sort models by Elo rating (descending).
 */
export function rankModels(
    ratings: Record<string, number>,
): readonly { readonly model: string; readonly elo: number }[] {
    return Object.entries(ratings)
        .map(([model, elo]) => ({ model, elo }))
        .sort((a, b) => b.elo - a.elo);
}
