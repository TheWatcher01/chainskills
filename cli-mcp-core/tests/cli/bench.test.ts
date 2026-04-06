/**
 * Tests for chainskills bench command logic.
 */

import { describe, it, expect } from 'vitest';
import { compareWithGolden } from '#adapters/golden/golden-loader.js';
import type { GoldenFile, BenchRunResult, BenchReport } from '#core/entities/bench-config.js';

describe('bench command logic', () => {
    it('should build BenchRunResult from execution', () => {
        const run: BenchRunResult = {
            model: 'test-model',
            runIndex: 0,
            duration_ms: 500,
            success: true,
            outputs: { score: 0.95, label: 'high' },
        };
        expect(run.success).toBe(true);
        expect(run.outputs['score']).toBe(0.95);
    });

    it('should compute golden pass/fail per run', () => {
        const golden: GoldenFile = {
            outputs: { label: 'high' },
            assertions: { ranges: { score: [0.0, 1.0] } },
        };

        const passResult = compareWithGolden({ label: 'high', score: 0.95 }, golden);
        expect(passResult.pass).toBe(true);

        const failResult = compareWithGolden({ label: 'low', score: 0.95 }, golden);
        expect(failResult.pass).toBe(false);
    });

    it('should aggregate BenchReport summary correctly', () => {
        const runs: BenchRunResult[] = [
            { model: 'A', runIndex: 0, duration_ms: 100, success: true, outputs: {} },
            { model: 'A', runIndex: 1, duration_ms: 200, success: true, outputs: {} },
            { model: 'B', runIndex: 0, duration_ms: 150, success: true, outputs: {} },
            { model: 'B', runIndex: 1, duration_ms: 300, success: false, outputs: {}, error: 'timeout' },
        ];

        const models = ['A', 'B'];
        const summary: BenchReport['summary'] = {};
        for (const model of models) {
            const modelRuns = runs.filter((r) => r.model === model);
            const successRuns = modelRuns.filter((r) => r.success);
            const totalDuration = modelRuns.reduce((s, r) => s + r.duration_ms, 0);
            summary[model] = {
                avgDuration_ms: Math.round(totalDuration / modelRuns.length),
                successRate: successRuns.length / modelRuns.length,
            };
        }

        expect(summary['A']!.avgDuration_ms).toBe(150);
        expect(summary['A']!.successRate).toBe(1.0);
        expect(summary['B']!.successRate).toBe(0.5);
    });

    it('should handle BenchReport with golden file', () => {
        const report: BenchReport = {
            workflow: 'test.workflow.md',
            models: ['A', 'B'],
            runsPerModel: 2,
            goldenFile: 'golden.json',
            summary: {
                A: { avgDuration_ms: 150, successRate: 1.0, goldenPassRate: 1.0 },
                B: { avgDuration_ms: 225, successRate: 0.5, goldenPassRate: 0.5 },
            },
            runs: [],
            timestamp: new Date().toISOString(),
        };

        expect(report.models).toHaveLength(2);
        expect(report.summary['A']!.goldenPassRate).toBe(1.0);
    });
});
