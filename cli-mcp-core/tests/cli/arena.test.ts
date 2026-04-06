/**
 * Tests for arena command logic — Elo rating integration.
 */

import { describe, it, expect } from 'vitest';
import { initializeElo, updateElo, rankModels, applyVotes } from '#core/services/elo-rating.js';
import type { ArenaVote, ArenaReport } from '#core/entities/arena-config.js';

describe('arena command logic', () => {
    it('should build ArenaReport structure', () => {
        const models = ['opus', 'sonnet', 'haiku'];
        const eloRatings = initializeElo(models);
        const votes: ArenaVote[] = [
            {
                roundIndex: 0, modelA: 'opus', modelB: 'sonnet',
                outputA: { result: 'A output' }, outputB: { result: 'B output' },
                winner: 'A', timestamp: new Date().toISOString(),
            },
        ];

        // Apply votes
        const { newRatingA, newRatingB } = updateElo(
            eloRatings['opus']!, eloRatings['sonnet']!, 'A',
        );

        const report: ArenaReport = {
            workflow: 'test.workflow.md',
            models,
            totalRounds: 1,
            votes,
            eloRatings: { opus: newRatingA, sonnet: newRatingB, haiku: 1500 },
            stats: {
                opus: { wins: 1, losses: 0, ties: 0 },
                sonnet: { wins: 0, losses: 1, ties: 0 },
                haiku: { wins: 0, losses: 0, ties: 0 },
            },
            timestamp: new Date().toISOString(),
        };

        expect(report.eloRatings['opus']).toBeGreaterThan(1500);
        expect(report.eloRatings['sonnet']).toBeLessThan(1500);
        expect(report.stats['opus']!.wins).toBe(1);
    });

    it('should rank models after multiple rounds', () => {
        const ratings = initializeElo(['A', 'B', 'C']);
        const votes = [
            { modelA: 'A', modelB: 'B', winner: 'A' as const },
            { modelA: 'A', modelB: 'C', winner: 'A' as const },
            { modelA: 'B', modelB: 'C', winner: 'B' as const },
        ];
        const updated = applyVotes(ratings, votes);
        const ranked = rankModels(updated);

        // A won 2 matches → ranked first
        expect(ranked[0]!.model).toBe('A');
        // A > C guaranteed (A beat C directly)
        expect(updated['A']).toBeGreaterThan(updated['C']!);
    });

    it('should handle ties in voting', () => {
        const { newRatingA, newRatingB } = updateElo(1500, 1500, 'tie');
        expect(newRatingA).toBe(1500);
        expect(newRatingB).toBe(1500);
    });

    it('should support non-interactive mode (all ties)', () => {
        // Simulates --json mode where all votes are ties
        const models = ['opus', 'sonnet'];
        const ratings = initializeElo(models);
        const votes = Array.from({ length: 5 }, (_, i) => ({
            modelA: 'opus', modelB: 'sonnet', winner: 'tie' as const,
        }));
        const updated = applyVotes(ratings, votes);

        expect(updated['opus']).toBe(1500);
        expect(updated['sonnet']).toBe(1500);
    });
});
