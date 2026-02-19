/**
 * CLI command: `chainskills run <workflow>`
 *
 * Parses and executes a `.workflow.md` file with real-time streaming output
 * via event emitter.
 *
 * @module cli/run
 */

import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { createContainer } from '#config/container.js';
import { runWorkflow } from '#core/use-cases/run-workflow.js';
import { parseWorkflow } from '#core/use-cases/parse-workflow.js';
import { validateWorkflow } from '#core/use-cases/validate-workflow.js';
import type { ExecutionEvent } from '#core/ports/execution-events.port.js';
import { readFileSync } from 'node:fs';

/** Collect all `--input` occurrences from raw argv (supports repeatable flags). */
function collectInputPairs(argv: string[]): string[] {
    const pairs: string[] = [];

    for (let i = 0; i < argv.length; i++) {
        const token = argv[i]!;

        if (token === '--input') {
            const next = argv[i + 1];
            if (next && !next.startsWith('-')) {
                pairs.push(next);
                i++;
            }
            continue;
        }

        if (token.startsWith('--input=')) {
            pairs.push(token.slice('--input='.length));
        }
    }

    return pairs;
}

export const runCommand = defineCommand({
    meta: {
        name: 'run',
        description: 'Run a .workflow.md file',
    },
    args: {
        workflow: {
            type: 'positional',
            description: 'Path to the .workflow.md file',
            required: true,
        },
        input: {
            type: 'string',
            description: 'Input variables as key=value (repeatable)',
            required: false,
        },
        'dry-run': {
            type: 'boolean',
            description: 'Simulate execution without side effects',
            default: false,
        },
        json: {
            type: 'boolean',
            description: 'Output result as JSON (machine-readable)',
            default: false,
        },
        format: {
            type: 'string',
            description: 'Output format: human | json | vscode (VS Code Problem Matcher)',
            default: 'human',
        },
        verbose: {
            type: 'boolean',
            alias: 'v',
            description: 'Show verbose debug logs on stderr',
            default: false,
        },
    },
    async run({ args }) {
        const workflowPath = resolve(args.workflow);
        const dryRun = args['dry-run'];
        const jsonMode = args.json || args.format === 'json';
        const vscodeMode = args.format === 'vscode';
        const verbose = args.verbose;

        // Parse inputs
        const inputs: Record<string, string> = {};
        const pairs = collectInputPairs(process.argv.slice(2));
        for (const pair of pairs) {
            const eqIdx = pair.indexOf('=');
            if (eqIdx > 0) {
                const key = pair.slice(0, eqIdx);
                const value = pair.slice(eqIdx + 1);
                inputs[key] = value;
            }
        }

        // Backward compatibility if argv extraction did not capture any --input
        if (pairs.length === 0 && args.input) {
            const fallbackPairs = Array.isArray(args.input)
                ? args.input
                : [args.input];
            for (const pair of fallbackPairs) {
                const eqIdx = pair.indexOf('=');
                if (eqIdx > 0) {
                    const key = pair.slice(0, eqIdx);
                    const value = pair.slice(eqIdx + 1);
                    inputs[key] = value;
                }
            }
        }

        // ── JSON mode — delegate to SDK API ─────────────────────────────
        if (jsonMode && !vscodeMode) {
            const container = await createContainer();
            const result = await runWorkflow(workflowPath, container, {
                inputs,
                dryRun,
            });

            if (result.ok) {
                console.log(
                    JSON.stringify({
                        ok: true,
                        workflow: result.value.workflow,
                        duration: result.value.duration,
                        steps: result.value.execution.steps,
                        outputs: result.value.execution.outputs,
                    }),
                );
            } else {
                console.log(
                    JSON.stringify({
                        ok: false,
                        error: {
                            code: result.error.code,
                            message: result.error.message,
                            phase: result.error.phase,
                            details: result.error.details,
                        },
                    }),
                );
                process.exit(1);
            }
            return;
        }

        // ── VS Code Problem Matcher format ────────────────────────────────
        if (vscodeMode) {
            const container = await createContainer();
            const result = await runWorkflow(workflowPath, container, {
                inputs,
                dryRun,
            });

            if (result.ok) {
                // Success — optionally print outputs in VS Code format
                const exec = result.value.execution;
                for (const step of exec.steps) {
                    if (step.status === 'failure' && step.error) {
                        console.error(
                            `${workflowPath}:1:1: error: Step ${step.stepId} failed: ${step.error}`,
                        );
                    }
                }
            } else {
                const err = result.error;
                console.error(
                    `${workflowPath}:1:1: error: ${err.message}`,
                );
                process.exit(1);
            }
            return;
        }

        // ── Interactive mode — original human-readable output ────────────

        // Read file
        let source: string;
        try {
            source = readFileSync(workflowPath, 'utf-8');
        } catch {
            console.error(pc.red(`Error: Cannot read file "${workflowPath}"`));
            process.exit(1);
        }

        // Create container — suppress logger noise in interactive mode
        // (stderr JSON lines can appear red in VS Code terminal, confusing users)
        const container = await createContainer({
            logLevel: verbose ? 'debug' : 'warn',
        });

        // Parse
        console.log(pc.cyan('⟫ Parsing workflow...'));
        const parseResult = parseWorkflow(source, container.parser);
        if (!parseResult.ok) {
            console.error(pc.red(`Parse error: ${parseResult.error.message}`));
            if (parseResult.error.line) {
                console.error(pc.dim(`  at line ${parseResult.error.line}`));
            }
            process.exit(1);
        }

        const workflow = parseResult.value;
        console.log(
            pc.green(`✓ ${workflow.name} v${workflow.version}`) +
            pc.dim(` (${workflow.steps.length} steps)`),
        );

        // Validate
        const validationResult = validateWorkflow(workflow);
        if (validationResult.ok) {
            const report = validationResult.value;
            if (!report.valid) {
                console.error(pc.red('Validation errors:'));
                for (const d of report.diagnostics) {
                    const icon = d.severity === 'error' ? pc.red('✗') : pc.yellow('⚠');
                    const loc = d.stepId ? pc.dim(` [${d.stepId}]`) : '';
                    console.error(`  ${icon} ${d.message}${loc}`);
                }
                process.exit(1);
            }

            // Show warnings
            const warnings = report.diagnostics.filter(
                (d) => d.severity === 'warning',
            );
            if (warnings.length > 0) {
                for (const w of warnings) {
                    console.log(pc.yellow(`  ⚠ ${w.message}`));
                }
            }
        }

        // Execute
        if (dryRun) {
            console.log(pc.yellow('\n⟫ Dry-run mode — no side effects\n'));
        } else {
            console.log(pc.cyan('\n⟫ Executing workflow...\n'));
        }

        // Wire streaming event listener for real-time output
        container.emitter.on((event: ExecutionEvent) => {
            switch (event.type) {
                case 'step:start':
                    console.log(
                        pc.cyan(`  ${pc.bold('▸')} Step ${event.stepIndex + 1}/${event.totalSteps}: ${pc.bold(event.stepTitle)}`),
                    );
                    break;

                case 'step:end':
                    if (event.success) {
                        console.log(
                            pc.green(`    ✓ completed`) + pc.dim(` (${event.duration}ms)`),
                        );
                    } else {
                        console.log(
                            pc.red(`    ✗ failed`) +
                            (event.error ? pc.dim(`: ${event.error}`) : ''),
                        );
                    }
                    break;

                case 'directive:start':
                    console.log(
                        pc.dim(`    @${event.directiveType}`) +
                        (event.raw ? pc.dim(` — ${event.raw.slice(0, 60)}`) : ''),
                    );
                    break;

                case 'parallel:start':
                    console.log(
                        pc.magenta(`    ═══ parallel start`) +
                        pc.dim(` (${event.stepIds.length} branches)`),
                    );
                    break;

                case 'parallel:end':
                    console.log(
                        pc.magenta(`    ═══ parallel end`) +
                        pc.dim(` (${event.duration}ms)`),
                    );
                    break;

                case 'loop:iteration':
                    console.log(
                        pc.dim(`    ↻ iteration ${event.index + 1}/${event.total}`),
                    );
                    break;

                case 'error':
                    console.log(
                        pc.red(`    ⚡ error: ${event.message}`),
                    );
                    break;

                // workflow:start and workflow:end handled at top level
                default:
                    break;
            }
        });

        const execResult = await container.executor.execute(
            workflow,
            inputs,
            { dryRun },
        );

        if (!execResult.ok) {
            console.error(
                pc.red(`\nExecution failed: ${execResult.error.message}`),
            );
            if (execResult.error.stepId) {
                console.error(pc.dim(`  at step: ${execResult.error.stepId}`));
            }
            process.exit(1);
        }

        // Summary
        const result = execResult.value;
        console.log(pc.green('\n✓ Workflow completed'));
        console.log(pc.dim(`  Duration: ${result.duration}ms`));
        console.log(
            pc.dim(
                `  Steps: ${result.steps.filter((s) => s.status === 'success').length}/${result.steps.length} passed`,
            ),
        );

        if (Object.keys(result.outputs).length > 0) {
            console.log(pc.cyan('\n⟫ Outputs:'));
            for (const [key, value] of Object.entries(result.outputs)) {
                console.log(`  ${pc.bold(key)}: ${JSON.stringify(value)}`);
            }
        }
    },
});
