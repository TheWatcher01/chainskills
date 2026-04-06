import { describe, it, expect } from 'vitest';
import { buildScorecard, recommend, classifyTask, type ScorecardEntry } from '#core/services/model-router.js';
import { createTree, addHypothesis, generateAntiLoopContext, detectCycle } from '#core/services/reflexion.js';
import { deepCompare } from '#core/services/deep-comparator.js';
import { compareTraces } from '#core/services/trace-comparator.js';
import { estimateCostWithEffort } from '#core/services/model-pricing.js';
import type { Hypothesis } from '#core/entities/hypothesis.js';
import type { ExecutionTrace } from '#core/entities/execution-trace.js';

function entry(overrides: Partial<ScorecardEntry>): ScorecardEntry {
    return {
        taskType: 'fix-bug',
        difficulty: 'medium',
        model: 'haiku',
        effort: 'high',
        pass: true,
        duration_ms: 100,
        tokens: 500,
        cost_usd: 0.001,
        toolCalls: 3,
        ...overrides,
    };
}

describe('v2 Pipeline Integration', () => {
    it('should route easy tasks to haiku and hard tasks to opus', () => {
        const entries: ScorecardEntry[] = [
            // Haiku excels at easy tasks
            ...Array.from({ length: 10 }, () => entry({ taskType: 'create-function', model: 'haiku', effort: 'low', pass: true, cost_usd: 0.0005 })),
            ...Array.from({ length: 10 }, () => entry({ taskType: 'create-function', model: 'opus', effort: 'high', pass: true, cost_usd: 0.01 })),
            // Haiku fails at expert tasks
            ...Array.from({ length: 10 }, () => entry({ taskType: 'audit', model: 'haiku', effort: 'high', pass: false, cost_usd: 0.002 })),
            ...Array.from({ length: 10 }, () => entry({ taskType: 'audit', model: 'opus', effort: 'high', pass: true, cost_usd: 0.01 })),
        ];

        const cascade = [
            { model: 'haiku', effort: 'low' as const },
            { model: 'haiku', effort: 'high' as const },
            { model: 'opus', effort: 'high' as const },
        ];
        const sc = buildScorecard(entries, { cascade, minRuns: 3, minPassRate: 0.9 });

        const easyRec = sc.recommendations.find((r) => r.taskType === 'create-function')!;
        const hardRec = sc.recommendations.find((r) => r.taskType === 'audit')!;

        expect(easyRec.model).toBe('haiku');
        expect(hardRec.model).toBe('opus');
        expect(sc.estimatedSavings).toBeGreaterThan(0);
    });

    it('should classify tasks and route them correctly', () => {
        const taskType = classifyTask('create a slugify function');
        expect(taskType).toBe('create-function');

        const auditType = classifyTask('audit the security of this server');
        expect(auditType).toBe('audit');
    });

    it('should build anti-loop context for exploration', () => {
        let tree = createTree('expert/07');

        const h1: Hypothesis = {
            id: 'h-1',
            taskId: 'expert/07',
            model: 'haiku',
            effort: 'low',
            description: 'Looked at processor.ts but missed the off-by-one',
            actions: ['Read processor.ts'],
            filesModified: ['src/processor.ts'],
            result: 'fail',
            score: 0,
            reflection: 'Only found 1 of 5 bugs',
            timestamp: new Date().toISOString(),
            tokens: 500,
            duration_ms: 2000,
        };

        tree = addHypothesis(tree, h1);

        const ctx = generateAntiLoopContext(tree);
        expect(ctx).toContain('FAILED APPROACHES');
        expect(ctx).toContain('off-by-one');

        // A similar approach should be detected as cycle
        expect(detectCycle(tree, 'Looked at processor.ts and missed the off-by-one error')).toBe(true);
        // A different approach should not
        expect(detectCycle(tree, 'Refactoring the authentication middleware')).toBe(false);
    });

    it('should compare code quality between solutions', () => {
        const opusSolution = `
export function processItems(items: Item[]): Result[] {
    return items
        .filter(item => item.isValid())
        .map(item => ({
            id: item.id,
            value: item.compute(),
            status: 'processed',
        }));
}`;

        const haikuSolution = `
export function processItems(items: any[]): any[] {
    const results: any[] = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i].isValid()) {
            if (items[i].compute() !== null) {
                if (items[i].compute() !== undefined) {
                    results.push({
                        id: items[i].id,
                        value: items[i].compute(),
                        status: 'processed',
                    });
                }
            }
        }
    }
    return results;
}`;

        const report = deepCompare(opusSolution, haikuSolution);
        expect(report.qualityScoreA).toBeGreaterThan(report.qualityScoreB);
        expect(report.verdict).toBe('A better');
    });

    it('should estimate cost savings with effort modulation', () => {
        const opusHigh = estimateCostWithEffort('opus', 100000, 50000, 'high');
        const haikuLow = estimateCostWithEffort('haiku', 100000, 50000, 'low');

        // haiku/low should be dramatically cheaper than opus/high
        expect(haikuLow).toBeLessThan(opusHigh * 0.1);
    });
});
