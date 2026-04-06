/**
 * CLI command: `chainskills leaderboard --input <dir> --output <dir>`
 *
 * Reads SuiteResult JSON files, builds an aggregated leaderboard,
 * and generates a static HTML site deployable on GitHub Pages.
 *
 * @module cli/leaderboard
 */

import { defineCommand } from 'citty';
import { resolve, join } from 'node:path';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import pc from 'picocolors';
import { buildLeaderboard, generateBadge } from '#core/services/leaderboard-builder.js';
import { generateLeaderboardHTML } from '#adapters/site/html-generator.js';
import type { SuiteResult } from '#core/entities/benchmark-suite.js';

export const leaderboardCommand = defineCommand({
    meta: {
        name: 'leaderboard',
        description: 'Generate a static leaderboard site from benchmark results',
    },
    args: {
        input: {
            type: 'string',
            alias: 'i',
            description: 'Directory containing SuiteResult JSON files',
            default: './bench-results',
        },
        output: {
            type: 'string',
            alias: 'o',
            description: 'Output directory for the site (default: ./site)',
            default: './site',
        },
        json: {
            type: 'boolean',
            description: 'Output leaderboard data as JSON only',
            default: false,
        },
    },
    async run({ args }) {
        const inputDir = resolve(args.input);
        const outputDir = resolve(args.output);
        const jsonMode = args.json;

        // Lire tous les SuiteResult JSON
        if (!existsSync(inputDir)) {
            console.error(pc.red(`Input directory not found: ${inputDir}`));
            console.error(pc.dim('Run `chainskills bench-suite` first to generate results.'));
            process.exit(1);
        }

        const files = readdirSync(inputDir)
            .filter((f) => f.endsWith('.json'))
            .map((f) => join(inputDir, f));

        if (files.length === 0) {
            console.error(pc.red('No JSON result files found in input directory.'));
            process.exit(1);
        }

        const results: SuiteResult[] = [];
        for (const file of files) {
            try {
                const content = readFileSync(file, 'utf-8');
                const parsed = JSON.parse(content) as SuiteResult;
                if (parsed.suiteVersion && parsed.modelMetrics) {
                    results.push(parsed);
                }
            } catch {
                // Ignorer les fichiers non-SuiteResult
            }
        }

        if (results.length === 0) {
            console.error(pc.red('No valid SuiteResult files found.'));
            process.exit(1);
        }

        if (!jsonMode) {
            console.log(pc.cyan(`\n  chainskills leaderboard`));
            console.log(pc.dim(`  Input: ${files.length} result files from ${inputDir}`));
        }

        // Construire le leaderboard
        const leaderboard = buildLeaderboard(results);

        if (jsonMode) {
            console.log(JSON.stringify(leaderboard, null, 2));
            return;
        }

        // Generer le site
        mkdirSync(outputDir, { recursive: true });

        // 1. data.json
        const dataPath = join(outputDir, 'data.json');
        writeFileSync(dataPath, JSON.stringify(leaderboard, null, 2), 'utf-8');

        // 2. index.html
        const htmlPath = join(outputDir, 'index.html');
        const html = generateLeaderboardHTML(leaderboard);
        writeFileSync(htmlPath, html, 'utf-8');

        // 3. Badges pour chaque modele
        const badgesDir = join(outputDir, 'badges');
        mkdirSync(badgesDir, { recursive: true });
        for (const entry of leaderboard.entries) {
            const badge = generateBadge(entry);
            const safeName = entry.model.replace(/[^a-zA-Z0-9-_.]/g, '_');
            writeFileSync(
                join(badgesDir, `${safeName}.json`),
                JSON.stringify(badge, null, 2),
                'utf-8',
            );
        }

        // Affichage
        console.log(pc.cyan('\n  Leaderboard'));
        console.log(pc.dim('═'.repeat(70)));
        console.log(
            pc.bold('  #  Model'.padEnd(30)) +
            pc.bold('Elo'.padEnd(8)) +
            pc.bold('Pass%'.padEnd(8)) +
            pc.bold('Cost'.padEnd(12)) +
            pc.bold('Latency'.padEnd(10)) +
            pc.bold('Pareto'),
        );
        console.log(pc.dim('─'.repeat(70)));

        for (let i = 0; i < leaderboard.entries.length; i++) {
            const e = leaderboard.entries[i]!;
            const rank = `${i + 1}.`;
            const model = e.model.length > 22 ? e.model.slice(0, 22) + '..' : e.model;
            const elo = `${e.elo}`;
            const pass = `${Math.round(e.passRate * 100)}%`;
            const cost = e.costPerTask_usd > 0 ? `$${e.costPerTask_usd.toFixed(4)}` : 'free';
            const latency = `${e.avgLatency_ms}ms`;
            const pareto = e.paretoRank === 1 ? pc.green('Frontier') : `#${e.paretoRank}`;

            console.log(
                `  ${rank.padEnd(3)} ${model.padEnd(25)}${elo.padEnd(8)}${pass.padEnd(8)}${cost.padEnd(12)}${latency.padEnd(10)}${pareto}`,
            );
        }

        console.log(pc.dim('═'.repeat(70)));
        console.log(pc.green(`\n  Site generated at: ${outputDir}/`));
        console.log(pc.dim(`  Files: index.html, data.json, badges/${leaderboard.entries.length} badges`));
        console.log(pc.dim('  Deploy: copy to gh-pages branch or docs/ folder'));
    },
});
