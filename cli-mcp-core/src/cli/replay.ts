/**
 * CLI command: `chainskills replay <trace-path> --model <model>`
 *
 * Replays a recorded workflow execution with a different LLM model.
 * Loads traces from a JSONL file or CRAG store, re-executes the workflow,
 * and optionally compares outputs.
 *
 * @module cli/replay
 */

import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { createContainer } from '#config/container.js';
import { runWorkflow } from '#core/use-cases/run-workflow.js';
import type { ExecutionTrace } from '#core/entities/execution-trace.js';

export const replayCommand = defineCommand({
    meta: {
        name: 'replay',
        description: 'Replay a workflow execution with a different LLM model',
    },
    args: {
        'trace-path': {
            type: 'positional',
            description: 'Path to trace JSONL file or run_id',
            required: true,
        },
        model: {
            type: 'string',
            description: 'Model to use for replay (e.g., ollama/qwen3.5:9b)',
            required: true,
        },
        compare: {
            type: 'boolean',
            description: 'Compare old vs new outputs',
            default: false,
        },
        output: {
            type: 'string',
            description: 'Save new traces to this JSONL file',
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
        const tracePath = args['trace-path'];
        const model = args.model;
        const compareMode = args.compare;
        const outputPath = args.output;
        const jsonMode = args.json;
        const verbose = args.verbose;

        // 1. Load old traces
        let oldTraces: ExecutionTrace[];
        const absPath = resolve(tracePath);

        if (existsSync(absPath) && absPath.endsWith('.jsonl')) {
            // Load from JSONL file
            const content = readFileSync(absPath, 'utf-8');
            oldTraces = content
                .split('\n')
                .filter(Boolean)
                .map((line) => JSON.parse(line) as ExecutionTrace);
        } else {
            // Try as run_id from traceStore
            const container = await createContainer({ logLevel: 'warn' });
            oldTraces = await container.traceStore.query({ run_id: tracePath });
        }

        if (oldTraces.length === 0) {
            console.error(pc.red(`No traces found at: ${tracePath}`));
            process.exit(1);
        }

        const workflowName = oldTraces[0]!.workflow_name;
        const oldModel = oldTraces[0]!.model ?? 'unknown';

        if (!jsonMode) {
            console.log(pc.cyan(`⟫ Replaying "${workflowName}" with model ${pc.bold(model)}`));
            console.log(pc.dim(`  Original model: ${oldModel}, ${oldTraces.length} traces`));
        }

        // 2. Find the workflow file
        const container = await createContainer({
            logLevel: verbose ? 'debug' : 'warn',
        });

        const searchDirs = [
            resolve('./templates'),
            resolve(container.config.workflowsDir),
            resolve('.'),
        ];

        let workflowPath: string | null = null;
        for (const dir of searchDirs) {
            const candidates = [
                resolve(dir, `${workflowName}.workflow.md`),
                resolve(dir, `**/${workflowName}.workflow.md`),
            ];
            for (const candidate of candidates) {
                if (existsSync(candidate)) {
                    workflowPath = candidate;
                    break;
                }
            }
            if (workflowPath) break;
        }

        if (!workflowPath) {
            console.error(pc.red(`Cannot find workflow file for "${workflowName}"`));
            console.error(pc.dim(`Searched in: ${searchDirs.join(', ')}`));
            process.exit(1);
        }

        // 3. Extract inputs from first trace's variables_snapshot
        const inputs: Record<string, unknown> = {};
        const snapshot = oldTraces[0]!.variables_snapshot;
        if (snapshot) {
            for (const [key, value] of Object.entries(snapshot)) {
                if (!key.startsWith('_')) {
                    inputs[key] = value;
                }
            }
        }

        // 4. Re-execute with new model
        // Set env override for agent model
        const prevModel = process.env['AGENT_MODEL'];
        process.env['AGENT_MODEL'] = model;

        const result = await runWorkflow(workflowPath, container, {
            inputs,
            dryRun: false,
        });

        // Restore env
        if (prevModel !== undefined) {
            process.env['AGENT_MODEL'] = prevModel;
        } else {
            delete process.env['AGENT_MODEL'];
        }

        if (!result.ok) {
            console.error(pc.red(`Replay failed: ${result.error.message}`));
            process.exit(2);
        }

        const newOutputs = result.value.execution.outputs;
        const newDuration = result.value.duration;

        // 5. Compare if requested
        if (compareMode && !jsonMode) {
            console.log(pc.yellow('\n⟫ Comparison'));
            console.log(pc.dim('─'.repeat(60)));

            // Collect old outputs from traces
            const oldOutputs: Record<string, string> = {};
            for (const trace of oldTraces) {
                if (trace.output) {
                    oldOutputs[`${trace.step_id}:${trace.directive_type}`] = trace.output;
                }
            }

            console.log(pc.dim(`  Old model: ${oldModel}`));
            console.log(pc.dim(`  New model: ${model}`));
            console.log(pc.dim(`  Old traces: ${oldTraces.length}`));
            console.log(pc.dim(`  New duration: ${newDuration}ms`));

            for (const [key, value] of Object.entries(newOutputs)) {
                console.log(`  ${pc.bold(key)}: ${JSON.stringify(value)}`);
            }
        }

        // 6. Save new traces if output path given
        if (outputPath) {
            const newTraces = await container.traceStore.query({ limit: 100 });
            const lines = newTraces.map((t) => JSON.stringify(t)).join('\n') + '\n';
            writeFileSync(resolve(outputPath), lines, 'utf-8');
            if (!jsonMode) {
                console.log(pc.green(`\n⟫ New traces saved to: ${outputPath}`));
            }
        }

        // 7. Output result
        if (jsonMode) {
            console.log(JSON.stringify({
                workflow: workflowName,
                oldModel,
                newModel: model,
                oldTraceCount: oldTraces.length,
                newDuration,
                outputs: newOutputs,
            }, null, 2));
        } else {
            console.log(pc.green(`\n✓ Replay complete in ${newDuration}ms`));
        }
    },
});
