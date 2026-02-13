/**
 * CLI command: `chainskills inspect <workflow>`
 *
 * Parses a `.workflow.md` file and displays its DAG structure as an ASCII
 * visualization. Supports `--json` for machine-readable output.
 *
 * @module cli/inspect
 */

import { defineCommand } from 'citty';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { createContainer } from '#config/container.js';
import { parseWorkflow } from '#core/use-cases/parse-workflow.js';
import { buildDAG } from '#core/use-cases/build-dag.js';
import type { DAGNode, DAG } from '#core/use-cases/build-dag.js';

// ─── ASCII DAG Renderer ─────────────────────────────────────────────────────

/** Box-drawing characters for tree rendering. */
const BOX = {
    vertical: '│',
    horizontal: '─',
    corner: '└',
    tee: '├',
    down: '┬',
    right: '►',
    parallel: '═',
    branch: '◇',
    loop: '↻',
    tryCatch: '⚡',
    sequential: '●',
} as const;

/** Icon for each DAG node type. */
function nodeIcon(type: string): string {
    switch (type) {
        case 'parallel':
            return BOX.parallel;
        case 'branch':
            return BOX.branch;
        case 'loop':
            return BOX.loop;
        case 'try-catch':
            return BOX.tryCatch;
        default:
            return BOX.sequential;
    }
}

/** Render a single DAG node with its children. */
function renderNode(
    node: DAGNode,
    prefix: string,
    isLast: boolean,
): string[] {
    const lines: string[] = [];
    const connector = isLast ? BOX.corner : BOX.tee;
    const icon = nodeIcon(node.type);
    const deps =
        node.dependencies.length > 0
            ? pc.dim(` ← [${node.dependencies.join(', ')}]`)
            : '';

    // Main node line
    let label = `${icon} ${pc.bold(node.stepId)}`;
    label += pc.dim(` (${node.type})`);
    if (node.condition) label += pc.yellow(` ? ${node.condition}`);
    if (node.iterable) label += pc.cyan(` ∈ $${node.iterable}`);
    if (node.loopVariable) label += pc.cyan(` as $${node.loopVariable}`);
    if (node.maxIterations) label += pc.dim(` max:${node.maxIterations}`);
    label += deps;

    lines.push(`${prefix}${connector}${BOX.horizontal}${BOX.horizontal} ${label}`);

    const childPrefix = prefix + (isLast ? '   ' : `${BOX.vertical}  `);

    // Variable info
    if (node.produces.length > 0) {
        lines.push(
            `${childPrefix}   ${pc.green('produces:')} ${node.produces.map((v) => `$${v}`).join(', ')}`,
        );
    }
    if (node.consumes.length > 0) {
        lines.push(
            `${childPrefix}   ${pc.blue('consumes:')} ${node.consumes.map((v) => `$${v}`).join(', ')}`,
        );
    }

    // Children
    if (node.children && node.children.length > 0) {
        lines.push(`${childPrefix}   ${pc.dim('children:')}`);
        for (let i = 0; i < node.children.length; i++) {
            const childLines = renderNode(
                node.children[i]!,
                childPrefix + '   ',
                i === node.children.length - 1,
            );
            lines.push(...childLines);
        }
    }

    // Else branch (for @if)
    if (node.elseBranch && node.elseBranch.length > 0) {
        lines.push(`${childPrefix}   ${pc.yellow('else:')}`);
        for (let i = 0; i < node.elseBranch.length; i++) {
            const childLines = renderNode(
                node.elseBranch[i]!,
                childPrefix + '   ',
                i === node.elseBranch.length - 1,
            );
            lines.push(...childLines);
        }
    }

    // Fallback (for @try)
    if (node.fallback && node.fallback.length > 0) {
        lines.push(`${childPrefix}   ${pc.red('on-error:')}`);
        for (let i = 0; i < node.fallback.length; i++) {
            const childLines = renderNode(
                node.fallback[i]!,
                childPrefix + '   ',
                i === node.fallback.length - 1,
            );
            lines.push(...childLines);
        }
    }

    return lines;
}

/** Render a complete DAG as ASCII art. */
function renderDAG(dag: DAG, workflowName: string): string {
    const lines: string[] = [];

    lines.push(pc.cyan(`\n⟫ DAG for ${pc.bold(workflowName)}`));
    lines.push(pc.dim(`  ${dag.nodes.length} nodes, ${dag.entryPoints.length} entry points\n`));

    if (dag.nodes.length === 0) {
        lines.push(pc.dim('  (empty workflow)'));
        return lines.join('\n');
    }

    // Render each top-level node
    for (let i = 0; i < dag.nodes.length; i++) {
        const node = dag.nodes[i]!;
        const nodeLines = renderNode(node, '', i === dag.nodes.length - 1);
        lines.push(...nodeLines);
    }

    // Parallel groups
    if (dag.parallelGroups.length > 0) {
        lines.push('');
        lines.push(pc.cyan('⟫ Parallel groups:'));
        for (let i = 0; i < dag.parallelGroups.length; i++) {
            const group = dag.parallelGroups[i]!;
            const marker = group.length > 1 ? pc.green('∥') : pc.dim('→');
            lines.push(
                `  ${pc.dim(`Level ${i}:`)} ${marker} ${group.map((id) => pc.bold(id)).join(', ')}`,
            );
        }
    }

    return lines.join('\n');
}

// ─── Command ─────────────────────────────────────────────────────────────────

export const inspectCommand = defineCommand({
    meta: {
        name: 'inspect',
        description: 'Inspect the DAG structure of a .workflow.md file',
    },
    args: {
        workflow: {
            type: 'positional',
            description: 'Path to the .workflow.md file',
            required: true,
        },
        json: {
            type: 'boolean',
            description: 'Output DAG as JSON',
            default: false,
        },
    },
    async run({ args }) {
        const workflowPath = resolve(args.workflow);
        const useJson = args.json;

        // Read file
        let source: string;
        try {
            source = readFileSync(workflowPath, 'utf-8');
        } catch {
            console.error(pc.red(`Error: Cannot read file "${workflowPath}"`));
            process.exit(1);
        }

        // Parse
        const container = createContainer();
        const parseResult = parseWorkflow(source, container.parser);
        if (!parseResult.ok) {
            console.error(pc.red(`Parse error: ${parseResult.error.message}`));
            process.exit(1);
        }

        const workflow = parseResult.value;

        // Build DAG
        const dagResult = buildDAG(workflow);
        if (!dagResult.ok) {
            console.error(pc.red(`DAG error: ${dagResult.error.message}`));
            process.exit(1);
        }

        const dag = dagResult.value;

        if (useJson) {
            console.log(JSON.stringify(dag, null, 2));
        } else {
            console.log(renderDAG(dag, workflow.name));
        }
    },
});
