/**
 * CLI command: `chainskills add <ref>`
 *
 * Installs a workflow from GitHub or local registry.
 *
 * @module cli/add
 */

import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { createContainer } from '#config/container.js';
import { createGitHubRegistry } from '#adapters/registry/github-registry.js';
import { createLocalRegistry } from '#adapters/registry/local-registry.js';

export const addCommand = defineCommand({
    meta: {
        name: 'add',
        description: 'Install a workflow from GitHub or local registry',
    },
    args: {
        ref: {
            type: 'positional',
            description: 'Workflow reference: owner/repo[@version] or name',
            required: true,
        },
        dir: {
            type: 'string',
            description: 'Install directory (default: ./workflows)',
            default: './workflows',
        },
        json: {
            type: 'boolean',
            description: 'Output as JSON',
            default: false,
        },
    },
    async run({ args }) {
        const ref = args.ref;
        const installDir = resolve(args.dir);
        const jsonMode = args.json;

        const container = await createContainer({ logLevel: 'warn' });
        const isGitHubRef = ref.includes('/');

        if (!jsonMode) {
            console.log(pc.cyan(`⟫ Installing "${ref}"...`));
        }

        let installedPath: string;

        if (isGitHubRef) {
            // GitHub: owner/repo[@version]
            const github = createGitHubRegistry({
                logger: container.logger,
                installDir,
            });
            const result = await github.install(ref);

            if (!result.ok) {
                console.error(pc.red(`GitHub install failed: ${result.error.message}`));
                process.exit(1);
            }
            installedPath = result.value;
        } else {
            // Local registry: search by name
            const local = createLocalRegistry({ logger: container.logger });
            const result = await local.install(ref);

            if (!result.ok) {
                console.error(pc.red(`Not found in local registry: ${ref}`));
                console.error(pc.dim('Use owner/repo format for GitHub, or publish locally first.'));
                process.exit(1);
            }
            installedPath = result.value;
        }

        if (jsonMode) {
            console.log(JSON.stringify({ ref, path: installedPath }, null, 2));
        } else {
            console.log(pc.green(`✓ Installed: ${installedPath}`));
        }
    },
});
