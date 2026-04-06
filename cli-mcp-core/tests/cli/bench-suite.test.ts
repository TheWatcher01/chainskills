/**
 * Tests for the bench-suite CLI command infrastructure.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import type { BenchDomain, BenchDifficulty } from '../../src/core/entities/benchmark-suite.js';

const BENCHMARKS_DIR = resolve(__dirname, '../../benchmarks');

describe('benchmark suite structure', () => {
    const EXPECTED_DOMAINS: BenchDomain[] = ['coding', 'data', 'security', 'writing', 'reasoning', 'tool-use'];
    const EXPECTED_DIFFICULTIES: BenchDifficulty[] = ['easy', 'medium', 'hard'];

    it('benchmarks directory exists', () => {
        expect(existsSync(BENCHMARKS_DIR)).toBe(true);
    });

    it('has all 6 domain directories', () => {
        for (const domain of EXPECTED_DOMAINS) {
            expect(existsSync(join(BENCHMARKS_DIR, domain))).toBe(true);
        }
    });

    it('has all difficulty levels per domain', () => {
        for (const domain of EXPECTED_DOMAINS) {
            for (const difficulty of EXPECTED_DIFFICULTIES) {
                expect(existsSync(join(BENCHMARKS_DIR, domain, difficulty))).toBe(true);
            }
        }
    });

    it('has at least 50 workflow files', () => {
        const { execSync } = require('node:child_process');
        const output = execSync(`find ${BENCHMARKS_DIR} -name "*.workflow.md" | wc -l`, { encoding: 'utf-8' });
        expect(parseInt(output.trim())).toBeGreaterThanOrEqual(50);
    });

    it('each workflow has valid frontmatter with domain and difficulty', () => {
        const { execSync } = require('node:child_process');
        const files = execSync(`find ${BENCHMARKS_DIR} -name "*.workflow.md"`, { encoding: 'utf-8' })
            .trim().split('\n').filter(Boolean);

        for (const file of files) {
            const content = readFileSync(file, 'utf-8');
            const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
            expect(fmMatch, `Missing frontmatter in ${relative(BENCHMARKS_DIR, file)}`).toBeTruthy();

            const fm = fmMatch![1]!;
            const domain = fm.match(/^domain:\s*(.+)$/m)?.[1]?.trim();
            const difficulty = fm.match(/^difficulty:\s*(.+)$/m)?.[1]?.trim();

            // Either frontmatter has domain/difficulty, or path infers them
            const rel = relative(BENCHMARKS_DIR, file);
            const parts = rel.split('/');
            const inferredDomain = parts[0];
            const inferredDifficulty = parts[1];

            const effectiveDomain = domain ?? inferredDomain;
            const effectiveDifficulty = difficulty ?? inferredDifficulty;

            expect(
                EXPECTED_DOMAINS.includes(effectiveDomain as BenchDomain),
                `Invalid domain "${effectiveDomain}" in ${rel}`,
            ).toBe(true);
            expect(
                EXPECTED_DIFFICULTIES.includes(effectiveDifficulty as BenchDifficulty),
                `Invalid difficulty "${effectiveDifficulty}" in ${rel}`,
            ).toBe(true);
        }
    });

    it('golden files reference existing workflows', () => {
        const { execSync } = require('node:child_process');
        const goldenFiles = execSync(`find ${BENCHMARKS_DIR} -name "*.golden.json"`, { encoding: 'utf-8' })
            .trim().split('\n').filter(Boolean);

        for (const goldenFile of goldenFiles) {
            const workflowPath = goldenFile.replace('.golden.json', '.workflow.md');
            expect(existsSync(workflowPath), `Golden file ${goldenFile} has no matching workflow`).toBe(true);

            // Validate JSON
            const content = readFileSync(goldenFile, 'utf-8');
            expect(() => JSON.parse(content)).not.toThrow();
        }
    });
});

describe('benchmark-suite types', () => {
    it('SuiteConfig type exists and is importable', async () => {
        const mod = await import('../../src/core/entities/benchmark-suite.js');
        expect(mod.BENCH_DOMAINS).toHaveLength(6);
        expect(mod.BENCH_DIFFICULTIES).toHaveLength(3);
    });
});
