/**
 * CLI command: `chainskills distill <trace-path> --output training.jsonl`
 *
 * Extracts fine-tuning pairs from execution traces.
 * Produces OpenAI-compatible JSONL for model training.
 *
 * @module cli/distill
 */

import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import pc from 'picocolors';
import { createContainer } from '#config/container.js';
import { distillTraces, toJsonl, distillStats } from '#core/services/distillation.js';
import type { ExecutionTrace } from '#core/entities/execution-trace.js';

export const distillCommand = defineCommand({
    meta: {
        name: 'distill',
        description: 'Extract fine-tuning data from execution traces',
    },
    args: {
        'trace-path': {
            type: 'positional',
            description: 'Path to trace JSONL file or run_id',
            required: true,
        },
        output: {
            type: 'string',
            description: 'Output JSONL file path (default: training.jsonl)',
            default: 'training.jsonl',
        },
        'min-confidence': {
            type: 'string',
            description: 'Minimum confidence threshold (default: 0.5)',
            default: '0.5',
        },
        json: {
            type: 'boolean',
            description: 'Output stats as JSON',
            default: false,
        },
    },
    async run({ args }) {
        const tracePath = args['trace-path'];
        const outputPath = resolve(args.output);
        const minConfidence = Number(args['min-confidence']) || 0.5;
        const jsonMode = args.json;

        // 1. Load traces
        let traces: ExecutionTrace[];
        const absPath = resolve(tracePath);

        if (existsSync(absPath) && absPath.endsWith('.jsonl')) {
            const content = readFileSync(absPath, 'utf-8');
            traces = content
                .split('\n')
                .filter(Boolean)
                .map((line) => JSON.parse(line) as ExecutionTrace);
        } else {
            // Try as run_id from traceStore
            const container = await createContainer({ logLevel: 'warn' });
            traces = await container.traceStore.query({ run_id: tracePath });
        }

        if (traces.length === 0) {
            console.error(pc.red(`No traces found: ${tracePath}`));
            process.exit(1);
        }

        // 2. Distill
        const examples = distillTraces(traces, { minConfidence });
        const stats = distillStats(traces, examples);

        // 3. Write output
        if (examples.length > 0) {
            const jsonl = toJsonl(examples);
            writeFileSync(outputPath, jsonl, 'utf-8');
        }

        // 4. Report
        if (jsonMode) {
            console.log(JSON.stringify({ output: outputPath, ...stats }, null, 2));
        } else {
            console.log(pc.cyan('⟫ Distillation complete'));
            console.log(`  Traces: ${stats.totalTraces}`);
            console.log(`  Extracted: ${pc.green(String(stats.filteredIn))} examples`);
            console.log(`  Filtered out: ${pc.dim(String(stats.filteredOut))}`);
            console.log(`  Avg confidence: ${pc.yellow(stats.avgConfidence.toFixed(2))}`);
            if (Object.keys(stats.byModel).length > 0) {
                console.log(`  By model:`);
                for (const [model, count] of Object.entries(stats.byModel)) {
                    console.log(`    ${model}: ${count}`);
                }
            }
            if (examples.length > 0) {
                console.log(pc.green(`\n✓ Saved to: ${outputPath}`));
            } else {
                console.log(pc.yellow('\n⚠ No examples met the confidence threshold'));
            }
        }
    },
});
