/**
 * CLI command: `chainskills init <name>`
 *
 * Scaffolds a new workflow with a `.workflow.md` template file.
 *
 * @module cli/init
 */

import { defineCommand } from 'citty';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import pc from 'picocolors';

const TEMPLATE = `---
name: {{NAME}}
description: Describe your workflow here
version: 0.1.0
inputs:
  - name: target
    type: string
    description: The target to process
outputs:
  - name: result
    type: string
    description: The workflow result
env: []
tags: []
---

# Step 1 — Setup

Prepare the environment and validate inputs.

@call shell.exec(echo "Starting {{NAME}}...") → $status

# Step 2 — Process

Process the target input.

@if $target:

@call shell.exec(echo "Processing $target") → $result

# Step 3 — Output

Emit the final result.

@output: $result
`;

export const initCommand = defineCommand({
    meta: {
        name: 'init',
        description: 'Create a new workflow from template',
    },
    args: {
        name: {
            type: 'positional',
            description: 'Name of the workflow (kebab-case)',
            required: true,
        },
        dir: {
            type: 'string',
            description: 'Target directory (default: current directory)',
            required: false,
        },
    },
    async run({ args }) {
        const name = args.name
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        if (!name) {
            console.error(pc.red('Error: Invalid workflow name'));
            process.exit(1);
        }

        const targetDir = resolve(args.dir ?? '.');
        const filePath = join(targetDir, `${name}.workflow.md`);

        // Check if file already exists
        if (existsSync(filePath)) {
            console.error(
                pc.red(`Error: File already exists: ${filePath}`),
            );
            process.exit(1);
        }

        // Create directory if needed
        mkdirSync(targetDir, { recursive: true });

        // Write template
        const content = TEMPLATE.replace(/\{\{NAME\}\}/g, name);
        writeFileSync(filePath, content, 'utf-8');

        console.log(pc.green(`✓ Created workflow: ${pc.bold(filePath)}`));
        console.log(pc.dim('\nNext steps:'));
        console.log(pc.dim(`  1. Edit ${name}.workflow.md`));
        console.log(
            pc.dim(`  2. chainskills validate ${name}.workflow.md`),
        );
        console.log(
            pc.dim(
                `  3. chainskills run ${name}.workflow.md --input target=example`,
            ),
        );
    },
});
