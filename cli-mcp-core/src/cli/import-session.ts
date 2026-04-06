/**
 * CLI command: `chainskills import-session <path>`
 *
 * Parses a Claude Code session transcript (JSONL) or chainskills recorder
 * capture into ExecutionTraces and saves them to the trace store.
 *
 * @module cli/import-session
 */

import { defineCommand } from 'citty';
import { resolve, basename } from 'node:path';
import { existsSync } from 'node:fs';
import pc from 'picocolors';
import { createContainer } from '#config/container.js';
import {
    parseClaudeCodeSession,
    parseRecorderCapture,
    groupByTask,
} from '#adapters/capture/session-parser.js';

export const importSessionCommand = defineCommand({
    meta: {
        name: 'import-session',
        description: 'Import a Claude Code session transcript as chainskills traces',
    },
    args: {
        path: {
            type: 'positional',
            description: 'Path to the session JSONL file',
            required: true,
        },
        format: {
            type: 'string',
            description: 'Input format: "claude" (transcript) or "recorder" (hook capture)',
            default: 'claude',
        },
        'show-tasks': {
            type: 'boolean',
            description: 'Show task groupings instead of importing',
            default: false,
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
        const filePath = resolve(args.path);
        const format = args.format as 'claude' | 'recorder';
        const showTasks = args['show-tasks'];
        const jsonMode = args.json;

        if (!existsSync(filePath)) {
            console.error(pc.red(`File not found: ${filePath}`));
            process.exit(1);
        }

        // Mode show-tasks : afficher les taches groupees
        if (showTasks) {
            const tasks = groupByTask(filePath);
            if (jsonMode) {
                console.log(JSON.stringify(tasks, null, 2));
            } else {
                console.log(pc.cyan(`\n  Session tasks (${tasks.length} groups)`));
                console.log(pc.dim('─'.repeat(70)));
                for (let i = 0; i < tasks.length; i++) {
                    const t = tasks[i]!;
                    const prompt = t.prompt.length > 60 ? t.prompt.slice(0, 60) + '...' : t.prompt;
                    console.log(`  ${pc.bold(`Task ${i + 1}`)} (${t.toolCalls.length} tool calls)`);
                    console.log(`  ${pc.dim(prompt || '(no prompt)')}`);
                    // Top 3 tools
                    const toolCounts = new Map<string, number>();
                    for (const tc of t.toolCalls) {
                        toolCounts.set(tc.tool, (toolCounts.get(tc.tool) ?? 0) + 1);
                    }
                    const topTools = [...toolCounts.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([t, c]) => `${t}(${c})`)
                        .join(', ');
                    console.log(`  ${pc.dim(`Tools: ${topTools}`)}\n`);
                }
            }
            return;
        }

        // Parser selon le format
        if (!jsonMode) {
            console.log(pc.cyan(`\n  Importing session: ${basename(filePath)}`));
            console.log(pc.dim(`  Format: ${format}`));
        }

        const traces = format === 'recorder'
            ? parseRecorderCapture(filePath)
            : parseClaudeCodeSession(filePath);

        if (traces.length === 0) {
            console.error(pc.red('No traces extracted from session.'));
            process.exit(1);
        }

        if (!jsonMode) {
            console.log(`  Traces extracted: ${pc.bold(String(traces.length))}`);

            // Stats
            const tools = new Map<string, number>();
            for (const t of traces) {
                let tool = t.directive_type;
                try { tool = JSON.parse(t.input).tool ?? tool; } catch { /* input may be truncated */ }
                tools.set(tool, (tools.get(tool) ?? 0) + 1);
            }
            console.log(pc.dim('  Tool breakdown:'));
            for (const [tool, count] of [...tools.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
                console.log(`    ${tool}: ${count}`);
            }
        }

        // Sauvegarder dans le trace store
        const container = await createContainer({ logLevel: 'warn' });
        for (const trace of traces) {
            container.traceStore.append(trace);
        }
        await container.traceStore.flush();

        const stats = await container.traceStore.stats();

        if (jsonMode) {
            console.log(JSON.stringify({ imported: traces.length, runId: traces[0]?.run_id, stats }, null, 2));
        } else {
            console.log(pc.green(`\n  Imported ${traces.length} traces (run: ${traces[0]?.run_id?.slice(0, 8)}...)`));
            console.log(pc.dim(`  Total traces in store: ${stats.total_traces}`));
        }
    },
});
