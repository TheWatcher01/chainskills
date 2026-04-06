/**
 * CLI command: `chainskills compare <session-a> <session-b>`
 *
 * Compares two session traces to evaluate if a cheaper model can
 * reproduce the work of a more expensive model.
 *
 * @module cli/compare
 */

import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import pc from 'picocolors';
import { parseClaudeCodeSession, parseRecorderCapture } from '#adapters/capture/session-parser.js';
import { compareTraces } from '#core/services/trace-comparator.js';

export const compareCommand = defineCommand({
    meta: {
        name: 'compare',
        description: 'Compare two session traces (e.g., Opus vs Haiku)',
    },
    args: {
        a: {
            type: 'positional',
            description: 'Path to session A (reference, e.g., Opus trace)',
            required: true,
        },
        b: {
            type: 'positional',
            description: 'Path to session B (candidate, e.g., Haiku trace)',
            required: true,
        },
        format: {
            type: 'string',
            description: 'Input format: "claude" or "recorder"',
            default: 'claude',
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
        const format = args.format as 'claude' | 'recorder';
        const jsonMode = args.json;

        for (const [label, path] of [['A', pathA], ['B', pathB]] as const) {
            if (!existsSync(path)) {
                console.error(pc.red(`Session ${label} not found: ${path}`));
                process.exit(1);
            }
        }

        const parser = format === 'recorder' ? parseRecorderCapture : parseClaudeCodeSession;
        const tracesA = parser(pathA);
        const tracesB = parser(pathB);

        if (tracesA.length === 0 || tracesB.length === 0) {
            console.error(pc.red('One or both sessions have no traces.'));
            process.exit(1);
        }

        const report = compareTraces(tracesA, tracesB);

        if (jsonMode) {
            console.log(JSON.stringify(report, null, 2));
            return;
        }

        // Affichage
        const verdictColor =
            report.verdict === 'equivalent' ? pc.green :
            report.verdict === 'improved' ? pc.green :
            report.verdict === 'degraded' ? pc.yellow :
            pc.red;

        console.log(pc.cyan('\n  chainskills compare'));
        console.log(pc.dim('═'.repeat(60)));
        console.log(`  Session A: ${tracesA.length} traces (${tracesA[0]?.workflow_name ?? 'unknown'})`);
        console.log(`  Session B: ${tracesB.length} traces (${tracesB[0]?.workflow_name ?? 'unknown'})`);
        console.log(pc.dim('─'.repeat(60)));

        console.log(`  Tool overlap:     ${formatPct(report.toolOverlap)}`);
        console.log(`  File overlap:     ${formatPct(report.fileOverlap)}`);
        console.log(`  Success rate A:   ${formatPct(report.successRateA)}`);
        console.log(`  Success rate B:   ${formatPct(report.successRateB)}`);
        console.log(`  Duration ratio:   ${report.durationRatio}x ${report.durationRatio < 1 ? pc.green('(faster)') : report.durationRatio > 1.5 ? pc.yellow('(slower)') : ''}`);

        if (report.toolsOnlyInA.length > 0) {
            console.log(pc.dim(`  Tools only in A: ${report.toolsOnlyInA.join(', ')}`));
        }
        if (report.toolsOnlyInB.length > 0) {
            console.log(pc.dim(`  Tools only in B: ${report.toolsOnlyInB.join(', ')}`));
        }

        console.log(pc.dim('─'.repeat(60)));
        console.log(`  Similarity:  ${pc.bold(String(report.similarityScore))}%`);
        console.log(`  Verdict:     ${verdictColor(pc.bold(report.verdict.toUpperCase()))}`);
        console.log(pc.dim('═'.repeat(60)));
    },
});

function formatPct(n: number): string {
    return `${Math.round(n * 100)}%`;
}
