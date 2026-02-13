/**
 * CLI command: `chainskills run <workflow>`
 *
 * Parses and executes a `.workflow.md` file.
 *
 * @module cli/run
 */

import { defineCommand } from 'citty';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { createContainer } from '#config/container.js';
import { parseWorkflow } from '#core/use-cases/parse-workflow.js';
import { validateWorkflow } from '#core/use-cases/validate-workflow.js';

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
    },
    async run({ args }) {
        const workflowPath = resolve(args.workflow);
        const dryRun = args['dry-run'];

        // Parse inputs
        const inputs: Record<string, string> = {};
        if (args.input) {
            const pairs = Array.isArray(args.input)
                ? args.input
                : [args.input];
            for (const pair of pairs) {
                const eqIdx = pair.indexOf('=');
                if (eqIdx > 0) {
                    const key = pair.slice(0, eqIdx);
                    const value = pair.slice(eqIdx + 1);
                    inputs[key] = value;
                }
            }
        }

        // Read file
        let source: string;
        try {
            source = readFileSync(workflowPath, 'utf-8');
        } catch {
            console.error(pc.red(`Error: Cannot read file "${workflowPath}"`));
            process.exit(1);
        }

        // Create container
        const container = createContainer();

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
