/**
 * Tests for Elo rating service.
 */

import { describe, it, expect } from 'vitest';
import { initializeElo, expectedScore, updateElo, applyVotes, rankModels } from '#core/services/elo-rating.js';

describe('Elo Rating Service', () => {
    it('should initialize all models at 1500', () => {
        const ratings = initializeElo(['opus', 'sonnet', 'haiku']);
        expect(ratings['opus']).toBe(1500);
        expect(ratings['sonnet']).toBe(1500);
        expect(ratings['haiku']).toBe(1500);
    });

    it('should calculate expected score of 0.5 for equal ratings', () => {
        expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
    });

    it('should give higher expected score to higher-rated player', () => {
        const score = expectedScore(1600, 1400);
        expect(score).toBeGreaterThan(0.5);
        expect(score).toBeLessThan(1.0);
    });

    it('should increase winner rating and decrease loser rating', () => {
        const { newRatingA, newRatingB } = updateElo(1500, 1500, 'A');
        expect(newRatingA).toBeGreaterThan(1500);
        expect(newRatingB).toBeLessThan(1500);
    });

    it('should keep ratings equal on tie between equal players', () => {
        const { newRatingA, newRatingB } = updateElo(1500, 1500, 'tie');
        expect(newRatingA).toBe(1500);
        expect(newRatingB).toBe(1500);
    });

    it('should change less when upset occurs (strong player loses)', () => {
        const { newRatingA: highWins } = updateElo(1700, 1300, 'A');
        const { newRatingA: lowWins } = updateElo(1300, 1700, 'A');
        // Low-rated beating high-rated should gain more
        const gainHigh = highWins - 1700;
        const gainLow = lowWins - 1300;
        expect(gainLow).toBeGreaterThan(gainHigh);
    });

    it('should apply multiple votes correctly', () => {
        const ratings = initializeElo(['A', 'B', 'C']);
        const votes = [
            { modelA: 'A', modelB: 'B', winner: 'A' as const },
            { modelA: 'B', modelB: 'C', winner: 'B' as const },
            { modelA: 'A', modelB: 'C', winner: 'A' as const },
        ];
        const updated = applyVotes(ratings, votes);
        // A won 2 matches, C lost 2 matches → A > C guaranteed
        expect(updated['A']).toBeGreaterThan(updated['C']!);
        // All ratings should have changed from base 1500
        expect(updated['A']).toBeGreaterThan(1500);
        expect(updated['C']).toBeLessThan(1500);
    });

    it('should rank models by Elo descending', () => {
        const ratings = { opus: 1600, sonnet: 1500, haiku: 1400 };
        const ranked = rankModels(ratings);
        expect(ranked[0]!.model).toBe('opus');
        expect(ranked[1]!.model).toBe('sonnet');
        expect(ranked[2]!.model).toBe('haiku');
    });
});
