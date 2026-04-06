/**
 * CLI command: `chainskills bench <workflow> --models <list> --runs <n>`
 *
 * Benchmarks a workflow across multiple LLM models with optional golden file comparison.
 * Generates a structured report with per-model statistics.
 *
 * @module cli/bench
 */

import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { createContainer } from '#config/container.js';
import { runWorkflow } from '#core/use-cases/run-workflow.js';
import { loadGoldenFile, compareWithGolden } from '#adapters/golden/golden-loader.js';
import type { BenchRunResult, BenchReport } from '#core/entities/bench-config.js';

export const benchCommand = defineCommand({
    meta: {
        name: 'bench',
        description: 'Benchmark a workflow across multiple LLM models',
    },
    args: {
        workflow: {
            type: 'positional',
            description: 'Path to the .workflow.md file',
            required: true,
        },
        models: {
            type: 'string',
            description: 'Comma-separated model list (e.g., opus,sonnet,qwen3.5)',
            required: true,
        },
        runs: {
            type: 'string',
            description: 'Number of runs per model (default 3)',
            default: '3',
        },
        golden: {
            type: 'string',
            description: 'Path to golden file for output comparison',
            required: false,
        },
        input: {
            type: 'string',
            description: 'Input variables as key=value',
            required: false,
        },
        output: {
            type: 'string',
            description: 'Save report to this JSON file',
            required: false,
        },
        json: {
            type: 'boolean',
            description: 'Output as JSON',
            default: false,
        },
        verbose: {
            type: 'boolean',
            alias: 'v',
            default: false,
        },
    },
    async run({ args }) {
        const workflowPath = resolve(args.workflow);
        const models = args.models.split(',').map((m) => m.trim()).filter(Boolean);
        const runsPerModel = Number(args.runs) || 3;
        const goldenPath = args.golden;
        const outputPath = args.output;
        const jsonMode = args.json;
        const verbose = args.verbose;

        if (models.length === 0) {
            console.error(pc.red('No models specified. Use --models model1,model2'));
            process.exit(1);
        }

        // Load golden file if provided
        let golden: import('#core/entities/bench-config.js').GoldenFile | null = null;
        if (goldenPath) {
            const goldenResult = await loadGoldenFile(resolve(goldenPath));
            if (!goldenResult.ok) {
                console.error(pc.red(`Golden file error: ${goldenResult.error.message}`));
                process.exit(1);
            }
            golden = goldenResult.value as import('#core/entities/bench-config.js').GoldenFile;
        }

        // Parse inputs
        const inputs: Record<string, string> = {};
        if (args.input) {
            for (const pair of args.input.split(',')) {
                const [key, ...valueParts] = pair.split('=');
                if (key) inputs[key.trim()] = valueParts.join('=').trim();
            }
        }

        if (!jsonMode) {
            console.log(pc.cyan(`⟫ Benchmarking "${args.workflow}"`));
            console.log(pc.dim(`  Models: ${models.join(', ')}`));
            console.log(pc.dim(`  Runs per model: ${runsPerModel}`));
            if (golden) console.log(pc.dim(`  Golden file: ${goldenPath}`));
        }

        // Execute benchmark
        const allRuns: BenchRunResult[] = [];

        for (const model of models) {
            if (!jsonMode) {
                console.log(pc.yellow(`\n⟫ Model: ${pc.bold(model)}`));
            }

            for (let i = 0; i < runsPerModel; i++) {
                const prevModel = process.env['AGENT_MODEL'];
                process.env['AGENT_MODEL'] = model;

                const container = await createContainer({
                    logLevel: verbose ? 'debug' : 'warn',
                });

                const startTime = Date.now();
                const result = await runWorkflow(workflowPath, container, {
                    inputs,
                    dryRun: false,
                });
                const duration = Date.now() - startTime;

                // Restore env
                if (prevModel !== undefined) {
                    process.env['AGENT_MODEL'] = prevModel;
                } else {
                    delete process.env['AGENT_MODEL'];
                }

                const run: BenchRunResult = result.ok
                    ? {
                        model,
                        runIndex: i,
                        duration_ms: duration,
                        success: true,
                        outputs: result.value.execution.outputs,
                        goldenPass: golden ? compareWithGolden(result.value.execution.outputs, golden).pass : undefined,
                        goldenFailures: golden ? compareWithGolden(result.value.execution.outputs, golden).failures : undefined,
                    }
                    : {
                        model,
                        runIndex: i,
                        duration_ms: duration,
                        success: false,
                        outputs: {},
                        error: result.error.message,
                        goldenPass: false,
                    };

                allRuns.push(run);

                if (!jsonMode) {
                    const status = run.success ? pc.green('✓') : pc.red('✗');
                    const goldenStatus = run.goldenPass === true ? pc.green('PASS') : run.goldenPass === false ? pc.red('FAIL') : '';
                    console.log(`  ${status} Run ${i + 1}: ${duration}ms ${goldenStatus}`);
                }
            }
        }

        // Compute summary
        const summary: BenchReport['summary'] = {};
        for (const model of models) {
            const modelRuns = allRuns.filter((r) => r.model === model);
            const successRuns = modelRuns.filter((r) => r.success);
            const totalDuration = modelRuns.reduce((sum, r) => sum + r.duration_ms, 0);
            const totalTokens = modelRuns.reduce((sum, r) => sum + (r.tokens?.prompt ?? 0) + (r.tokens?.completion ?? 0), 0);
            const goldenPasses = modelRuns.filter((r) => r.goldenPass === true).length;

            summary[model] = {
                avgDuration_ms: Math.round(totalDuration / modelRuns.length),
                successRate: successRuns.length / modelRuns.length,
                avgTokens: totalTokens > 0 ? Math.round(totalTokens / modelRuns.length) : undefined,
                goldenPassRate: golden ? goldenPasses / modelRuns.length : undefined,
            };
        }

        const report: BenchReport = {
            workflow: args.workflow,
            models,
            runsPerModel,
            goldenFile: goldenPath,
            summary,
            runs: allRuns,
            timestamp: new Date().toISOString(),
        };

        // Save report
        if (outputPath) {
            writeFileSync(resolve(outputPath), JSON.stringify(report, null, 2), 'utf-8');
            if (!jsonMode) console.log(pc.green(`\n⟫ Report saved to: ${outputPath}`));
        }

        // Display summary
        if (jsonMode) {
            console.log(JSON.stringify(report, null, 2));
        } else {
            console.log(pc.cyan('\n⟫ Summary'));
            console.log(pc.dim('─'.repeat(70)));
            console.log(
                pc.bold('  Model'.padEnd(25)) +
                pc.bold('Avg Duration'.padEnd(15)) +
                pc.bold('Success'.padEnd(10)) +
                (golden ? pc.bold('Golden'.padEnd(10)) : ''),
            );
            console.log(pc.dim('─'.repeat(70)));

            for (const model of models) {
                const s = summary[model]!;
                const duration = `${s.avgDuration_ms}ms`;
                const success = `${Math.round(s.successRate * 100)}%`;
                const goldenStr = s.goldenPassRate !== undefined ? `${Math.round(s.goldenPassRate * 100)}%` : '';

                console.log(
                    `  ${model.padEnd(25)}${duration.padEnd(15)}${success.padEnd(10)}${goldenStr}`,
                );
            }
        }
    },
});
