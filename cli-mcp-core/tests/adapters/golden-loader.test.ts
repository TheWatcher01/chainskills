/**
 * Tests for golden file loader and comparison.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadGoldenFile, compareWithGolden } from '#adapters/golden/golden-loader.js';
import type { GoldenFile } from '#core/entities/bench-config.js';

describe('loadGoldenFile', () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'chainskills-golden-test-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('should load a valid golden file', async () => {
        const golden: GoldenFile = {
            outputs: { score: 0.95, label: 'high_risk' },
        };
        const filePath = join(tmpDir, 'golden.json');
        await writeFile(filePath, JSON.stringify(golden));

        const result = await loadGoldenFile(filePath);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputs.score).toBe(0.95);
        }
    });

    it('should reject file without outputs', async () => {
        const filePath = join(tmpDir, 'bad.json');
        await writeFile(filePath, '{"name": "test"}');

        const result = await loadGoldenFile(filePath);
        expect(result.ok).toBe(false);
    });

    it('should reject nonexistent file', async () => {
        const result = await loadGoldenFile('/tmp/nonexistent-golden-file.json');
        expect(result.ok).toBe(false);
    });

    it('should reject invalid JSON', async () => {
        const filePath = join(tmpDir, 'invalid.json');
        await writeFile(filePath, 'not json');

        const result = await loadGoldenFile(filePath);
        expect(result.ok).toBe(false);
    });
});

describe('compareWithGolden', () => {
    it('should pass when outputs match exactly', () => {
        const golden: GoldenFile = {
            outputs: { score: 0.95, label: 'high' },
        };

        const result = compareWithGolden({ score: 0.95, label: 'high' }, golden);
        expect(result.pass).toBe(true);
        expect(result.failures).toHaveLength(0);
    });

    it('should fail on output mismatch', () => {
        const golden: GoldenFile = {
            outputs: { score: 0.95 },
        };

        const result = compareWithGolden({ score: 0.5 }, golden);
        expect(result.pass).toBe(false);
        expect(result.failures[0]).toContain('Output mismatch');
    });

    it('should fail on missing output', () => {
        const golden: GoldenFile = {
            outputs: { score: 0.95 },
        };

        const result = compareWithGolden({}, golden);
        expect(result.pass).toBe(false);
        expect(result.failures[0]).toContain('Missing output');
    });

    it('should check range assertions', () => {
        const golden: GoldenFile = {
            outputs: {},
            assertions: {
                ranges: { score: [0.0, 1.0] },
            },
        };

        expect(compareWithGolden({ score: 0.5 }, golden).pass).toBe(true);
        expect(compareWithGolden({ score: 1.5 }, golden).pass).toBe(false);
        expect(compareWithGolden({ score: -0.1 }, golden).pass).toBe(false);
    });

    it('should check type assertions', () => {
        const golden: GoldenFile = {
            outputs: {},
            assertions: {
                types: { name: 'string', score: 'number' },
            },
        };

        expect(compareWithGolden({ name: 'Alice', score: 42 }, golden).pass).toBe(true);
        expect(compareWithGolden({ name: 123, score: 42 }, golden).pass).toBe(false);
    });

    it('should check pattern assertions', () => {
        const golden: GoldenFile = {
            outputs: {},
            assertions: {
                patterns: { status: '^(ok|error|pending)$' },
            },
        };

        expect(compareWithGolden({ status: 'ok' }, golden).pass).toBe(true);
        expect(compareWithGolden({ status: 'error' }, golden).pass).toBe(true);
        expect(compareWithGolden({ status: 'invalid' }, golden).pass).toBe(false);
    });

    it('should count all checked assertions', () => {
        const golden: GoldenFile = {
            outputs: { a: 1, b: 2 },
            assertions: {
                ranges: { c: [0, 10] },
                types: { d: 'string' },
            },
        };

        const result = compareWithGolden({ a: 1, b: 2, c: 5, d: 'hello' }, golden);
        expect(result.checked).toBe(4); // 2 outputs + 1 range + 1 type
    });
});
