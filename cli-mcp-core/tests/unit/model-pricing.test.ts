import { describe, it, expect } from 'vitest';
import {
    getModelPricing,
    estimateCost,
    estimateCostWithEffort,
    getEffortMultiplier,
    listKnownModels,
} from '#core/services/model-pricing.js';

describe('getModelPricing', () => {
    it('should return pricing for exact model name', () => {
        const p = getModelPricing('claude-opus-4-6');
        expect(p).not.toBeNull();
        expect(p!.input_per_mtok).toBe(15);
        expect(p!.output_per_mtok).toBe(75);
    });

    it('should return pricing for alias', () => {
        const p = getModelPricing('haiku');
        expect(p).not.toBeNull();
        expect(p!.input_per_mtok).toBe(1);
    });

    it('should fuzzy match model with version suffix', () => {
        const p = getModelPricing('claude-sonnet-4-6-20260401');
        expect(p).not.toBeNull();
        expect(p!.input_per_mtok).toBe(3);
    });

    it('should return null for unknown model', () => {
        expect(getModelPricing('totally-unknown-model')).toBeNull();
    });
});

describe('estimateCost', () => {
    it('should compute cost for 1M input + 100K output tokens', () => {
        const cost = estimateCost('claude-opus-4-6', 1_000_000, 100_000);
        // 1M * $15/M + 100K * $75/M = $15 + $7.5 = $22.5
        expect(cost).toBeCloseTo(22.5, 1);
    });

    it('should return 0 for unknown model', () => {
        expect(estimateCost('unknown', 1000, 1000)).toBe(0);
    });

    it('should return 0 for free models', () => {
        expect(estimateCost('qwen3:8b', 1_000_000, 1_000_000)).toBe(0);
    });
});

describe('estimateCostWithEffort', () => {
    it('should reduce cost for low effort (0.4x)', () => {
        const base = estimateCost('opus', 10000, 5000);
        const low = estimateCostWithEffort('opus', 10000, 5000, 'low');
        expect(low).toBeCloseTo(base * 0.4, 6);
    });

    it('should keep cost same for high effort (1.0x)', () => {
        const base = estimateCost('opus', 10000, 5000);
        const high = estimateCostWithEffort('opus', 10000, 5000, 'high');
        expect(high).toBeCloseTo(base, 6);
    });

    it('should increase cost for max effort (1.3x)', () => {
        const base = estimateCost('opus', 10000, 5000);
        const max = estimateCostWithEffort('opus', 10000, 5000, 'max');
        expect(max).toBeCloseTo(base * 1.3, 6);
    });
});

describe('getEffortMultiplier', () => {
    it('should return correct multipliers', () => {
        expect(getEffortMultiplier('low')).toBe(0.4);
        expect(getEffortMultiplier('medium')).toBe(0.7);
        expect(getEffortMultiplier('high')).toBe(1.0);
        expect(getEffortMultiplier('max')).toBe(1.3);
    });

    it('should default to 1.0 for unknown effort', () => {
        expect(getEffortMultiplier('turbo')).toBe(1.0);
    });
});

describe('listKnownModels', () => {
    it('should include Claude models', () => {
        const models = listKnownModels();
        expect(models).toContain('claude-opus-4-6');
        expect(models).toContain('haiku');
        expect(models).toContain('sonnet');
    });
});
