/**
 * CLI command: `chainskills deep-compare <path-a> <path-b>`
 *
 * Compares two code files or directories using structural quality metrics.
 *
 * @module cli/deep-compare
 */

import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import pc from 'picocolors';
import { deepCompare } from '#core/services/deep-comparator.js';

/** Read all .ts/.js files in a path (file or directory). */
function readSourceFiles(path: string): string {
    const stat = statSync(path);
    if (stat.isFile()) return readFileSync(path, 'utf-8');

    // Directory: concatenate all .ts/.js files
    const sources: string[] = [];
    function walk(dir: string): void {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = resolve(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                walk(full);
            } else if (entry.isFile() && /\.(ts|js|tsx|jsx)$/.test(entry.name) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
                sources.push(readFileSync(full, 'utf-8'));
            }
        }
    }
    walk(path);
    return sources.join('\n');
}

/** Try running ESLint on a path. */
function tryEslint(path: string): { errors: number; warnings: number } | undefined {
    try {
        const result = execSync(
            `npx eslint --format json "${path}" 2>/dev/null`,
            { encoding: 'utf-8', timeout: 15000 },
        );
        const parsed = JSON.parse(result) as Array<{ errorCount: number; warningCount: number }>;
        const errors = parsed.reduce((s, f) => s + f.errorCount, 0);
        const warnings = parsed.reduce((s, f) => s + f.warningCount, 0);
        return { errors, warnings };
    } catch {
        return undefined;
    }
}

export const deepCompareCommand = defineCommand({
    meta: {
        name: 'deep-compare',
        description: 'Compare code quality between two solutions',
    },
    args: {
        a: {
            type: 'positional',
            description: 'Path to solution A (file or directory)',
            required: true,
        },
        b: {
            type: 'positional',
            description: 'Path to solution B (file or directory)',
            required: true,
        },
        eslint: {
            type: 'boolean',
            description: 'Run ESLint on both solutions (slower but more accurate)',
            default: false,
        },
        json: {
            type: 'boolean',
            description: 'Output as JSON',
            default: false,
        },
    },
    async run({ args }) {
        const pathA = resolve(args.a);
        const pathB = resolve(args.b);

        for (const [label, p] of [['A', pathA], ['B', pathB]] as const) {
            if (!existsSync(p)) {
                console.error(pc.red(`Solution ${label} not found: ${p}`));
                process.exit(1);
            }
        }

        const sourceA = readSourceFiles(pathA);
        const sourceB = readSourceFiles(pathB);

        if (!sourceA || !sourceB) {
            console.error(pc.red('No source code found in one or both paths.'));
            process.exit(1);
        }

        // Optional ESLint
        const eslintA = args.eslint ? tryEslint(pathA) : undefined;
        const eslintB = args.eslint ? tryEslint(pathB) : undefined;

        const report = deepCompare(sourceA, sourceB, eslintA, eslintB);

        if (args.json) {
            console.log(JSON.stringify(report, null, 2));
            return;
        }

        const verdictColor =
            report.verdict === 'A better' ? pc.green :
            report.verdict === 'B better' ? pc.yellow :
            report.verdict === 'equivalent' ? pc.green :
            pc.dim;

        console.log(pc.cyan('\n  chainskills deep-compare'));
        console.log(pc.dim('═'.repeat(55)));
        console.log(
            pc.bold('  Metric'.padEnd(22)) +
            pc.bold('Solution A'.padEnd(15)) +
            pc.bold('Solution B'),
        );
        console.log(pc.dim('─'.repeat(55)));

        const m = (label: string, a: number | string, b: number | string) => {
            console.log(`  ${label.padEnd(22)}${String(a).padEnd(15)}${b}`);
        };

        m('Lines of code', report.metricsA.linesOfCode, report.metricsB.linesOfCode);
        m('Functions', report.metricsA.functionCount, report.metricsB.functionCount);
        m('Avg nesting', report.metricsA.avgNestingDepth, report.metricsB.avgNestingDepth);
        m('Max nesting', report.metricsA.maxNestingDepth, report.metricsB.maxNestingDepth);
        m('Branch count', report.metricsA.branchCount, report.metricsB.branchCount);
        m('Duplicates', report.metricsA.duplicateLines, report.metricsB.duplicateLines);

        if (eslintA || eslintB) {
            m('ESLint errors', report.metricsA.eslintErrors, report.metricsB.eslintErrors);
            m('ESLint warnings', report.metricsA.eslintWarnings, report.metricsB.eslintWarnings);
        }

        console.log(pc.dim('─'.repeat(55)));
        console.log(`  ${'Quality score'.padEnd(22)}${pc.bold(String(report.qualityScoreA) + '/100').padEnd(15)}${pc.bold(String(report.qualityScoreB) + '/100')}`);
        console.log(`  ${'Verdict'.padEnd(22)}${verdictColor(pc.bold(report.verdict))}`);

        if (report.reasons.length > 0) {
            console.log(pc.dim(`\n  Reasons:`));
            for (const r of report.reasons) {
                console.log(pc.dim(`    - ${r}`));
            }
        }
        console.log(pc.dim('═'.repeat(55)));
    },
});
