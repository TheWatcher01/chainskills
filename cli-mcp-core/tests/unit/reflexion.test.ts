import { describe, it, expect } from 'vitest';
import {
    createTree,
    addHypothesis,
    generateAntiLoopContext,
    detectCycle,
    suggestNext,
    summarizeTree,
} from '#core/services/reflexion.js';
import type { Hypothesis } from '#core/entities/hypothesis.js';

function makeHypothesis(overrides: Partial<Hypothesis> = {}): Hypothesis {
    return {
        id: 'h-1',
        taskId: 'expert/01',
        model: 'haiku',
        effort: 'low',
        description: 'Fix the cache store race condition',
        actions: ['Read cache/store.ts', 'Edit line 22'],
        filesModified: ['src/cache/store.ts'],
        result: 'fail',
        score: 0,
        reflection: 'Wrong file targeted',
        timestamp: new Date().toISOString(),
        tokens: 500,
        duration_ms: 1200,
        ...overrides,
    };
}

describe('createTree', () => {
    it('should create an empty tree with taskId', () => {
        const tree = createTree('expert/01');
        expect(tree.taskId).toBe('expert/01');
        expect(tree.hypotheses).toHaveLength(0);
        expect(tree.bestScore).toBe(0);
        expect(tree.explored).toBe(0);
    });
});

describe('addHypothesis', () => {
    it('should add hypothesis and update bestScore', () => {
        let tree = createTree('task-1');
        tree = addHypothesis(tree, makeHypothesis({ score: 30 }));

        expect(tree.hypotheses).toHaveLength(1);
        expect(tree.bestScore).toBe(30);
        expect(tree.explored).toBe(1);
    });

    it('should track best model+effort', () => {
        let tree = createTree('task-1');
        tree = addHypothesis(tree, makeHypothesis({ score: 20, model: 'haiku', effort: 'low' }));
        tree = addHypothesis(tree, makeHypothesis({ id: 'h-2', score: 80, model: 'opus', effort: 'high', description: 'Deep analysis of all files' }));

        expect(tree.bestScore).toBe(80);
        expect(tree.bestModelEffort).toBe('opus/high');
    });

    it('should count unique approaches', () => {
        let tree = createTree('task-1');
        tree = addHypothesis(tree, makeHypothesis({ description: 'approach A' }));
        tree = addHypothesis(tree, makeHypothesis({ id: 'h-2', description: 'approach B' }));
        tree = addHypothesis(tree, makeHypothesis({ id: 'h-3', description: 'approach A' }));

        expect(tree.explored).toBe(2);
    });
});

describe('generateAntiLoopContext', () => {
    it('should return empty string for empty tree', () => {
        const tree = createTree('task-1');
        expect(generateAntiLoopContext(tree)).toBe('');
    });

    it('should include failed approaches', () => {
        let tree = createTree('task-1');
        tree = addHypothesis(tree, makeHypothesis({ result: 'fail', score: 10, reflection: 'Wrong approach' }));

        const ctx = generateAntiLoopContext(tree);
        expect(ctx).toContain('FAILED APPROACHES');
        expect(ctx).toContain('Wrong approach');
        expect(ctx).toContain('haiku/low');
    });

    it('should include successful approaches', () => {
        let tree = createTree('task-1');
        tree = addHypothesis(tree, makeHypothesis({ result: 'pass', score: 100 }));

        const ctx = generateAntiLoopContext(tree);
        expect(ctx).toContain('SUCCESSFUL APPROACHES');
    });
});

describe('detectCycle', () => {
    it('should detect similar descriptions (Jaccard > 0.6)', () => {
        let tree = createTree('task-1');
        tree = addHypothesis(tree, makeHypothesis({
            description: 'Fix the cache store race condition in store.ts',
            result: 'fail',
        }));

        expect(detectCycle(tree, 'Fix the cache store race condition in store.ts file')).toBe(true);
    });

    it('should not flag different descriptions', () => {
        let tree = createTree('task-1');
        tree = addHypothesis(tree, makeHypothesis({
            description: 'Fix the cache store race condition',
            result: 'fail',
        }));

        expect(detectCycle(tree, 'Refactor the authentication middleware completely')).toBe(false);
    });

    it('should ignore successful hypotheses', () => {
        let tree = createTree('task-1');
        tree = addHypothesis(tree, makeHypothesis({
            description: 'Fix the cache store race condition',
            result: 'pass',
        }));

        expect(detectCycle(tree, 'Fix the cache store race condition')).toBe(false);
    });
});

describe('suggestNext', () => {
    it('should suggest unexplored areas', () => {
        let tree = createTree('task-1');
        tree = addHypothesis(tree, makeHypothesis({ filesModified: ['src/cache/store.ts'] }));

        const suggestion = suggestNext(tree);
        expect(suggestion).toBeTruthy();
        expect(suggestion).not.toContain('src/cache');
    });

    it('should suggest upgrading model when all areas explored', () => {
        const tree = createTree('task-1');
        // Empty tree with no unexplored areas and no hypotheses
        expect(suggestNext(tree)).toBeNull();
    });
});

describe('summarizeTree', () => {
    it('should produce readable summary', () => {
        let tree = createTree('task-1');
        tree = addHypothesis(tree, makeHypothesis({ result: 'fail', score: 20, tokens: 500 }));
        tree = addHypothesis(tree, makeHypothesis({ id: 'h-2', result: 'pass', score: 90, tokens: 1200, description: 'Different approach' }));

        const summary = summarizeTree(tree);
        expect(summary).toContain('2 attempts');
        expect(summary).toContain('1 pass');
        expect(summary).toContain('1 fail');
        expect(summary).toContain('Tokens: 1700');
    });
});
