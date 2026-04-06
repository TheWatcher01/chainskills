import { describe, it, expect } from 'vitest';
import { buildScorecard, recommend, classifyTask, type ScorecardEntry } from '#core/services/model-router.js';
import type { RouterConfig, EffortLevel } from '#core/entities/model-router.js';

const CASCADE: RouterConfig['cascade'] = [
    { model: 'haiku', effort: 'low' },
    { model: 'haiku', effort: 'high' },
    { model: 'sonnet', effort: 'medium' },
    { model: 'opus', effort: 'high' },
];

function entry(overrides: Partial<ScorecardEntry> & { taskType: string; model: string; pass: boolean }): ScorecardEntry {
    return {
        difficulty: 'medium',
        effort: 'high',
        duration_ms: 100,
        tokens: 500,
        cost_usd: 0.001,
        toolCalls: 3,
        ...overrides,
    };
}

function repeat<T>(n: number, fn: (i: number) => T): T[] {
    return Array.from({ length: n }, (_, i) => fn(i));
}

describe('buildScorecard', () => {
    it('should aggregate entries by (taskType, model, effort)', () => {
        const entries: ScorecardEntry[] = [
            ...repeat(5, () => entry({ taskType: 'fix-bug', model: 'haiku', pass: true, cost_usd: 0.001 })),
            ...repeat(5, () => entry({ taskType: 'fix-bug', model: 'opus', pass: true, cost_usd: 0.01 })),
        ];
        const sc = buildScorecard(entries, { cascade: CASCADE, minRuns: 1 });

        expect(sc.totalRuns).toBe(10);
        expect(sc.models).toContain('haiku');
        expect(sc.models).toContain('opus');
        expect(sc.taskTypes).toEqual(['fix-bug']);
        expect(sc.metrics.length).toBe(2);
    });

    it('should compute correct pass rates', () => {
        const entries: ScorecardEntry[] = [
            ...repeat(8, () => entry({ taskType: 'refactor', model: 'sonnet', effort: 'medium', pass: true })),
            ...repeat(2, () => entry({ taskType: 'refactor', model: 'sonnet', effort: 'medium', pass: false })),
        ];
        const sc = buildScorecard(entries, { cascade: CASCADE, minRuns: 1 });
        const m = sc.metrics.find((m) => m.model === 'sonnet')!;

        expect(m.runs).toBe(10);
        expect(m.passCount).toBe(8);
        expect(m.passRate).toBe(0.8);
    });

    it('should generate recommendations per task type', () => {
        const entries: ScorecardEntry[] = [
            ...repeat(5, () => entry({ taskType: 'fix-bug', model: 'haiku', effort: 'high', pass: true, cost_usd: 0.001 })),
            ...repeat(5, () => entry({ taskType: 'fix-bug', model: 'opus', effort: 'high', pass: true, cost_usd: 0.01 })),
        ];
        const sc = buildScorecard(entries, { cascade: CASCADE, minRuns: 3, minPassRate: 0.9 });

        expect(sc.recommendations.length).toBe(1);
        expect(sc.recommendations[0]!.model).toBe('haiku');
    });
});

describe('recommend', () => {
    it('should return cheapest model meeting pass rate threshold', () => {
        const entries: ScorecardEntry[] = [
            ...repeat(10, () => entry({ taskType: 'create-function', model: 'haiku', effort: 'low', pass: true, cost_usd: 0.0005 })),
            ...repeat(10, () => entry({ taskType: 'create-function', model: 'opus', effort: 'high', pass: true, cost_usd: 0.01 })),
        ];
        const sc = buildScorecard(entries, { cascade: CASCADE, minRuns: 3, minPassRate: 0.9 });
        const rec = sc.recommendations.find((r) => r.taskType === 'create-function')!;

        expect(rec.model).toBe('haiku');
        expect(rec.effort).toBe('low');
        expect(rec.savingsVsExpensive).toBeGreaterThan(0);
    });

    it('should fallback to opus when no model meets threshold', () => {
        const entries: ScorecardEntry[] = [
            ...repeat(10, () => entry({ taskType: 'audit', model: 'haiku', effort: 'high', pass: false })),
            ...repeat(10, () => entry({ taskType: 'audit', model: 'opus', effort: 'high', pass: true, cost_usd: 0.01 })),
        ];
        const sc = buildScorecard(entries, { cascade: CASCADE, minRuns: 3, minPassRate: 0.9 });
        const rec = sc.recommendations.find((r) => r.taskType === 'audit')!;

        expect(rec.model).toBe('opus');
    });

    it('should default to most expensive model when no data exists', () => {
        const rec = recommend('unknown-task', [], { cascade: CASCADE, minRuns: 3, minPassRate: 0.9, preferCheaper: true });

        expect(rec.model).toBe('opus');
        expect(rec.confidence).toBe(0);
    });

    it('should increase confidence with more runs', () => {
        const few = repeat(3, () => entry({ taskType: 't', model: 'haiku', effort: 'low', pass: true, cost_usd: 0.001 }));
        const many = repeat(50, () => entry({ taskType: 't', model: 'haiku', effort: 'low', pass: true, cost_usd: 0.001 }));

        const scFew = buildScorecard(few, { cascade: CASCADE, minRuns: 1, minPassRate: 0.9 });
        const scMany = buildScorecard(many, { cascade: CASCADE, minRuns: 1, minPassRate: 0.9 });

        const confFew = scFew.recommendations[0]!.confidence;
        const confMany = scMany.recommendations[0]!.confidence;

        expect(confMany).toBeGreaterThan(confFew);
    });
});

describe('classifyTask', () => {
    it('should classify "create a function" as create-function', () => {
        expect(classifyTask('create a slugify function')).toBe('create-function');
    });

    it('should classify "fix the bug" as fix-bug', () => {
        expect(classifyTask('fix the bug in calculator.ts')).toBe('fix-bug');
    });

    it('should classify audit-related tasks', () => {
        expect(classifyTask('audit security of the server')).toBe('audit');
    });

    it('should return unknown for unclassifiable tasks', () => {
        expect(classifyTask('')).toBe('unknown');
    });
});
