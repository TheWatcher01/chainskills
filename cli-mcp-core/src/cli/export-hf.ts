/**
 * CLI command: `chainskills export-hf --input <dir> --output <dir>`
 *
 * Exports benchmark results as a HuggingFace-compatible dataset.
 * Generates train.jsonl + README.md (dataset card).
 *
 * @module cli/export-hf
 */

import { defineCommand } from 'citty';
import { resolve, join } from 'node:path';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import pc from 'picocolors';
import {
    suiteResultsToRecords,
    toJsonl,
    generateDatasetCard,
} from '#adapters/export/hf-dataset-builder.js';
import type { SuiteResult } from '#core/entities/benchmark-suite.js';

export const exportHfCommand = defineCommand({
    meta: {
        name: 'export-hf',
        description: 'Export benchmark results as HuggingFace dataset',
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
            description: 'Output directory for the dataset',
            default: './dataset',
        },
        json: {
            type: 'boolean',
            description: 'Output stats as JSON',
            default: false,
        },
    },
    async run({ args }) {
        const inputDir = resolve(args.input);
        const outputDir = resolve(args.output);
        const jsonMode = args.json;

        if (!existsSync(inputDir)) {
            console.error(pc.red(`Input directory not found: ${inputDir}`));
            process.exit(1);
        }

        // Lire les SuiteResult JSON
        const files = readdirSync(inputDir)
            .filter((f) => f.endsWith('.json'))
            .map((f) => join(inputDir, f));

        const results: SuiteResult[] = [];
        for (const file of files) {
            try {
                const content = readFileSync(file, 'utf-8');
                const parsed = JSON.parse(content) as SuiteResult;
                if (parsed.suiteVersion && parsed.modelMetrics) {
                    results.push(parsed);
                }
            } catch {
                // Skip non-SuiteResult files
            }
        }

        if (results.length === 0) {
            console.error(pc.red('No valid SuiteResult files found.'));
            process.exit(1);
        }

        // Convertir en records HF
        const records = suiteResultsToRecords(results);
        const jsonl = toJsonl(records);
        const card = generateDatasetCard(results, records);

        // Ecrire le dataset
        mkdirSync(outputDir, { recursive: true });
        writeFileSync(join(outputDir, 'train.jsonl'), jsonl, 'utf-8');
        writeFileSync(join(outputDir, 'README.md'), card, 'utf-8');

        const stats = {
            records: records.length,
            models: [...new Set(records.map((r) => r.model))],
            domains: [...new Set(records.map((r) => r.domain))],
            successRate: records.filter((r) => r.success).length / records.length,
            outputDir,
        };

        if (jsonMode) {
            console.log(JSON.stringify(stats, null, 2));
        } else {
            console.log(pc.cyan(`\n  chainskills export-hf`));
            console.log(pc.dim('─'.repeat(50)));
            console.log(`  Records: ${stats.records}`);
            console.log(`  Models: ${stats.models.join(', ')}`);
            console.log(`  Domains: ${stats.domains.join(', ')}`);
            console.log(`  Success rate: ${Math.round(stats.successRate * 100)}%`);
            console.log(pc.dim('─'.repeat(50)));
            console.log(pc.green(`  Dataset saved to: ${outputDir}/`));
            console.log(pc.dim('  Files: train.jsonl, README.md'));
            console.log(pc.dim('  Load: datasets.load_dataset("json", data_files="train.jsonl")'));
        }
    },
});
