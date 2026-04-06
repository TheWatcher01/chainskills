/**
 * CLI command: `chainskills publish <workflow.md>`
 *
 * Publishes a workflow to GitHub (release + tag) and the local registry.
 *
 * @module cli/publish
 */

import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { createContainer } from '#config/container.js';
import { parseWorkflow } from '#core/use-cases/parse-workflow.js';
import { validateWorkflow } from '#core/use-cases/validate-workflow.js';
import { readFileSync } from 'node:fs';
import { createGitHubRegistry } from '#adapters/registry/github-registry.js';
import { createLocalRegistry } from '#adapters/registry/local-registry.js';

export const publishCommand = defineCommand({
    meta: {
        name: 'publish',
        description: 'Publish a workflow to GitHub and local registry',
    },
    args: {
        workflow: {
            type: 'positional',
            description: 'Path to the .workflow.md file',
            required: true,
        },
        'local-only': {
            type: 'boolean',
            description: 'Only publish to local registry (skip GitHub)',
            default: false,
        },
        json: {
            type: 'boolean',
            description: 'Output as JSON',
            default: false,
        },
    },
    async run({ args }) {
        const workflowPath = resolve(args.workflow);
        const localOnly = args['local-only'];
        const jsonMode = args.json;

        // 1. Read and validate
        let source: string;
        try {
            source = readFileSync(workflowPath, 'utf-8');
        } catch {
            console.error(pc.red(`Cannot read: ${workflowPath}`));
            process.exit(1);
        }

        const container = await createContainer({ logLevel: 'warn' });
        const parseResult = parseWorkflow(source, container.parser);
        if (!parseResult.ok) {
            console.error(pc.red(`Parse error: ${parseResult.error.message}`));
            process.exit(1);
        }

        const validation = validateWorkflow(parseResult.value);
        if (!validation.ok) {
            console.error(pc.red(`Validation error: ${validation.error.message}`));
            process.exit(1);
        }

        if (!validation.value.valid) {
            console.error(pc.red('Workflow has validation errors:'));
            for (const diag of validation.value.diagnostics) {
                console.error(pc.red(`  - ${diag.message}`));
            }
            process.exit(1);
        }

        const workflow = parseResult.value;

        if (!jsonMode) {
            console.log(pc.cyan(`⟫ Publishing "${workflow.name}" v${workflow.version}`));
        }

        // 2. Publish to local registry (always)
        const localRegistry = createLocalRegistry({ logger: container.logger });
        const localResult = await localRegistry.publish(workflowPath);
        if (!localResult.ok) {
            console.error(pc.red(`Local publish failed: ${localResult.error.message}`));
            process.exit(1);
        }

        if (!jsonMode) {
            console.log(pc.green(`  ✓ Local registry: ${localResult.value}`));
        }

        // 3. Publish to GitHub (unless --local-only)
        let githubUrl: string | null = null;
        if (!localOnly) {
            const githubRegistry = createGitHubRegistry({ logger: container.logger });
            const githubResult = await githubRegistry.publish(workflowPath);
            if (githubResult.ok) {
                githubUrl = githubResult.value;
                if (!jsonMode) {
                    console.log(pc.green(`  ✓ GitHub release: ${githubUrl}`));
                }
            } else {
                if (!jsonMode) {
                    console.log(pc.yellow(`  ⚠ GitHub publish skipped: ${githubResult.error.message}`));
                }
            }
        }

        // 4. Report
        if (jsonMode) {
            console.log(JSON.stringify({
                workflow: workflow.name,
                version: workflow.version,
                local: localResult.value,
                github: githubUrl,
            }, null, 2));
        } else {
            console.log(pc.green(`\n✓ Published "${workflow.name}" v${workflow.version}`));
        }
    },
});
