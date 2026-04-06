import { describe, it, expect } from 'vitest';
import { extractMetrics, computeQualityScore, deepCompare } from '#core/services/deep-comparator.js';

const CLEAN_CODE = `
export function add(a: number, b: number): number {
    return a + b;
}

export function subtract(a: number, b: number): number {
    return a - b;
}

export function multiply(a: number, b: number): number {
    return a * b;
}
`;

const MESSY_CODE = `
export function calculate(a: any, b: any, op: any): any {
    if (op == 'add') {
        if (typeof a == 'number') {
            if (typeof b == 'number') {
                return a + b;
            } else {
                return a + b;
            }
        }
    }
    if (op == 'subtract') {
        if (typeof a == 'number') {
            if (typeof b == 'number') {
                return a - b;
            } else {
                return a - b;
            }
        }
    }
    if (op == 'subtract') {
        if (typeof a == 'number') {
            if (typeof b == 'number') {
                return a - b;
            } else {
                return a - b;
            }
        }
    }
}
`;

describe('extractMetrics', () => {
    it('should count lines of code', () => {
        const m = extractMetrics(CLEAN_CODE);
        expect(m.linesOfCode).toBeGreaterThan(5);
    });

    it('should count functions', () => {
        const m = extractMetrics(CLEAN_CODE);
        expect(m.functionCount).toBe(3);
    });

    it('should compute nesting depth', () => {
        const clean = extractMetrics(CLEAN_CODE);
        const messy = extractMetrics(MESSY_CODE);
        expect(messy.maxNestingDepth).toBeGreaterThan(clean.maxNestingDepth);
    });

    it('should count branches', () => {
        const messy = extractMetrics(MESSY_CODE);
        expect(messy.branchCount).toBeGreaterThan(5);
    });

    it('should detect duplicate lines', () => {
        const messy = extractMetrics(MESSY_CODE);
        expect(messy.duplicateLines).toBeGreaterThan(0);
    });
});

describe('computeQualityScore', () => {
    it('should score clean code higher', () => {
        const cleanScore = computeQualityScore(extractMetrics(CLEAN_CODE));
        const messyScore = computeQualityScore(extractMetrics(MESSY_CODE));
        expect(cleanScore).toBeGreaterThan(messyScore);
    });

    it('should penalize ESLint errors', () => {
        const base = computeQualityScore({ ...extractMetrics(CLEAN_CODE), eslintErrors: 0 });
        const withErrors = computeQualityScore({ ...extractMetrics(CLEAN_CODE), eslintErrors: 5 });
        expect(base).toBeGreaterThan(withErrors);
    });

    it('should return score between 0 and 100', () => {
        const score = computeQualityScore(extractMetrics(CLEAN_CODE));
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
    });
});

describe('deepCompare', () => {
    it('should report A better when A is cleaner', () => {
        const report = deepCompare(CLEAN_CODE, MESSY_CODE);
        expect(report.verdict).toBe('A better');
        expect(report.qualityScoreA).toBeGreaterThan(report.qualityScoreB);
    });

    it('should report inconclusive for identical code (no differences to analyze)', () => {
        const report = deepCompare(CLEAN_CODE, CLEAN_CODE);
        expect(report.verdict).toBe('inconclusive');
        expect(report.qualityScoreA).toBe(report.qualityScoreB);
    });

    it('should include reasons', () => {
        const report = deepCompare(CLEAN_CODE, MESSY_CODE);
        expect(report.reasons.length).toBeGreaterThan(0);
    });
});
