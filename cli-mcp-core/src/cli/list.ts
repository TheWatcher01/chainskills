/**
 * CLI command: `chainskills list`
 *
 * Lists all `.workflow.md` files found in the current directory (or specified
 * directory) with their metadata from frontmatter.
 *
 * @module cli/list
 */

import { defineCommand } from 'citty';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import pc from 'picocolors';
import { createContainer } from '#config/container.js';
import { parseWorkflow } from '#core/use-cases/parse-workflow.js';

/** Recursively find all .workflow.md files in a directory. */
function findWorkflowFiles(dir: string, maxDepth: number = 3): string[] {
    const files: string[] = [];

    function walk(currentDir: string, depth: number): void {
        if (depth > maxDepth) return;

        let entries: string[];
        try {
            entries = readdirSync(currentDir);
        } catch {
            return;
        }

        for (const entry of entries) {
            // Skip hidden dirs and node_modules
            if (entry.startsWith('.') || entry === 'node_modules') continue;

            const fullPath = join(currentDir, entry);
            let stat;
            try {
                stat = statSync(fullPath);
            } catch {
                continue;
            }

            if (stat.isDirectory()) {
                walk(fullPath, depth + 1);
            } else if (entry.endsWith('.workflow.md')) {
                files.push(fullPath);
            }
        }
    }

    walk(dir, 0);
    return files.sort();
}

export const listCommand = defineCommand({
    meta: {
        name: 'list',
        description: 'List all .workflow.md files',
    },
    args: {
        dir: {
            type: 'string',
            description: 'Directory to search (default: current directory)',
            required: false,
        },
        global: {
            type: 'boolean',
            alias: ['g'],
            description: 'Search in global workflows directory',
            default: false,
        },
        json: {
            type: 'boolean',
            description: 'Output as JSON',
            default: false,
        },
    },
    async run({ args }) {
        const searchDir = resolve(args.dir ?? '.');
        const useJson = args.json;

        const files = findWorkflowFiles(searchDir);

        if (files.length === 0) {
            if (useJson) {
                console.log(JSON.stringify([]));
            } else {
                console.log(pc.dim('No .workflow.md files found'));
            }
            return;
        }

        const container = createContainer();
        const workflows: Array<{
            path: string;
            name: string;
            version: string;
            description: string;
            steps: number;
            tags: string[];
        }> = [];

        for (const filePath of files) {
            try {
                const source = readFileSync(filePath, 'utf-8');
                const result = parseWorkflow(source, container.parser);
                if (result.ok) {
                    workflows.push({
                        path: relative(searchDir, filePath),
                        name: result.value.name,
                        version: result.value.version,
                        description: result.value.description,
                        steps: result.value.steps.length,
                        tags: [...result.value.tags],
                    });
                } else {
                    workflows.push({
                        path: relative(searchDir, filePath),
                        name: '(parse error)',
                        version: '-',
                        description: result.error.message,
                        steps: 0,
                        tags: [],
                    });
                }
            } catch {
                workflows.push({
                    path: relative(searchDir, filePath),
                    name: '(read error)',
                    version: '-',
                    description: 'Failed to read file',
                    steps: 0,
                    tags: [],
                });
            }
        }

        if (useJson) {
            console.log(JSON.stringify(workflows, null, 2));
            return;
        }

        console.log(pc.cyan(`\n⟫ Workflows in ${pc.bold(searchDir)}\n`));

        for (const wf of workflows) {
            const nameStr = pc.bold(wf.name);
            const versionStr = pc.dim(`v${wf.version}`);
            const stepsStr = pc.dim(`(${wf.steps} steps)`);
            const tagsStr =
                wf.tags.length > 0
                    ? pc.blue(` [${wf.tags.join(', ')}]`)
                    : '';
            const pathStr = pc.dim(`  ${wf.path}`);

            console.log(`  ${nameStr} ${versionStr} ${stepsStr}${tagsStr}`);
            console.log(`  ${pc.dim(wf.description)}`);
            console.log(pathStr);
            console.log('');
        }

        console.log(pc.dim(`  ${workflows.length} workflow(s) found`));
    },
});
