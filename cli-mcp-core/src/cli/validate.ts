/**
 * CLI command: `chainskills validate <workflow>`
 *
 * Parses and validates a `.workflow.md` file without executing it.
 *
 * @module cli/validate
 */

import { defineCommand } from 'citty';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { createContainer } from '#config/container.js';
import { parseWorkflow } from '#core/use-cases/parse-workflow.js';
import { validateWorkflow } from '#core/use-cases/validate-workflow.js';

export const validateCommand = defineCommand({
    meta: {
        name: 'validate',
        description: 'Validate a .workflow.md file',
    },
    args: {
        workflow: {
            type: 'positional',
            description: 'Path to the .workflow.md file',
            required: true,
        },
    },
    async run({ args }) {
        const workflowPath = resolve(args.workflow);

        // Read file
        let source: string;
        try {
            source = readFileSync(workflowPath, 'utf-8');
        } catch {
            console.error(pc.red(`Error: Cannot read file "${workflowPath}"`));
            process.exit(1);
        }

        const container = createContainer();

        // Parse
        console.log(pc.cyan('⟫ Parsing...'));
        const parseResult = parseWorkflow(source, container.parser);
        if (!parseResult.ok) {
            console.error(pc.red(`✗ Parse error: ${parseResult.error.message}`));
            if (parseResult.error.line) {
                console.error(pc.dim(`  at line ${parseResult.error.line}`));
            }
            process.exit(1);
        }

        const workflow = parseResult.value;
        console.log(
            pc.green(`✓ Parsed: ${workflow.name} v${workflow.version}`) +
            pc.dim(` (${workflow.steps.length} steps)`),
        );

        // Validate
        console.log(pc.cyan('⟫ Validating...'));
        const validationResult = validateWorkflow(workflow);

        if (!validationResult.ok) {
            console.error(
                pc.red(`✗ Validation error: ${validationResult.error.message}`),
            );
            process.exit(1);
        }

        const report = validationResult.value;

        // Show diagnostics
        const errors = report.diagnostics.filter(
            (d) => d.severity === 'error',
        );
        const warnings = report.diagnostics.filter(
            (d) => d.severity === 'warning',
        );

        for (const d of errors) {
            const loc = d.stepId ? pc.dim(` [${d.stepId}]`) : '';
            console.error(`  ${pc.red('✗')} ${d.message}${loc}`);
        }

        for (const w of warnings) {
            const loc = w.stepId ? pc.dim(` [${w.stepId}]`) : '';
            console.log(`  ${pc.yellow('⚠')} ${w.message}${loc}`);
        }

        // Summary
        if (report.valid) {
            console.log(
                pc.green(`\n✓ Workflow is valid`) +
                (warnings.length > 0
                    ? pc.yellow(` (${warnings.length} warning${warnings.length > 1 ? 's' : ''})`)
                    : ''),
            );
        } else {
            console.error(
                pc.red(
                    `\n✗ Workflow is invalid (${errors.length} error${errors.length > 1 ? 's' : ''})`,
                ),
            );
            process.exit(1);
        }

        // Workflow summary
        console.log(pc.dim('\nWorkflow summary:'));
        console.log(pc.dim(`  Name:        ${workflow.name}`));
        console.log(pc.dim(`  Version:     ${workflow.version}`));
        console.log(pc.dim(`  Steps:       ${workflow.steps.length}`));
        console.log(pc.dim(`  Inputs:      ${workflow.inputs.length}`));
        console.log(pc.dim(`  Outputs:     ${workflow.outputs.length}`));
        console.log(pc.dim(`  Env vars:    ${workflow.env.length}`));
        console.log(pc.dim(`  Tags:        ${workflow.tags.join(', ') || '(none)'}`));
    },
});
