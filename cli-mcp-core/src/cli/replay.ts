/**
 * CLI command: `chainskills replay`
 *
 * Replays a previously recorded workflow run.
 *
 * @module cli/replay
 */

import { defineCommand } from 'citty';
import pc from 'picocolors';
import { createSqlitePersistence } from '#adapters/state/sqlite-persistence.js';
import { createSqliteRunHistory } from '#adapters/state/sqlite-run-history.js';

export const replayCommand = defineCommand({
    meta: {
        name: 'replay',
        description: 'Replay a recorded workflow run',
    },
    args: {
        runId: {
            type: 'positional',
            description: 'Run ID to replay',
            required: true,
        },
        from: {
            type: 'string',
            description: 'Step ID to replay from',
            required: false,
        },
        diff: {
            type: 'boolean',
            description: 'Show diff between original and replay outputs',
            default: false,
        },
        json: {
            type: 'boolean',
            description: 'Output as JSON',
            default: false,
        },
    },
    async run({ args }) {
        let persistence;
        try {
            persistence = createSqlitePersistence();
        } catch {
            console.error(pc.red('No history database found.'));
            process.exitCode = 1;
            return;
        }

        const history = createSqliteRunHistory(persistence);

        try {
            const run = history.getRun(args.runId);
            if (!run) {
                console.error(pc.red(`Run not found: ${args.runId}`));
                process.exitCode = 1;
                return;
            }

            const events = history.getEvents(args.runId);

            if (args.json) {
                console.log(JSON.stringify({
                    run,
                    events,
                    replayFrom: args.from,
                }, null, 2));
                return;
            }

            console.log(pc.cyan('\n⟫ Replay\n'));
            console.log(`  ${pc.bold('Run:')}       ${run.id}`);
            console.log(`  ${pc.bold('Workflow:')}  ${run.workflowName}`);
            console.log(`  ${pc.bold('Status:')}    ${run.status}`);
            console.log(`  ${pc.bold('Duration:')}  ${run.durationMs ?? '?'}ms`);

            if (args.from) {
                console.log(`  ${pc.bold('From:')}      ${args.from}`);
            }

            console.log(`\n  ${pc.bold('Event Timeline:')}\n`);

            let startedShowing = !args.from;
            for (const event of events) {
                if (args.from && event.stepId === args.from) {
                    startedShowing = true;
                }
                if (!startedShowing) continue;

                const stepStr = event.stepId ? ` [${event.stepId}]` : '';
                const icon = eventIcon(event.eventType);
                console.log(`    ${icon} ${event.eventType}${pc.dim(stepStr)}`);

                if (event.data) {
                    const dataStr = JSON.stringify(event.data);
                    if (dataStr.length < 120) {
                        console.log(`      ${pc.dim(dataStr)}`);
                    }
                }
            }

            if (args.diff && run.outputs) {
                console.log(`\n  ${pc.bold('Original Outputs:')}`);
                console.log(`    ${JSON.stringify(run.outputs, null, 2).split('\n').join('\n    ')}`);
            }

            console.log('');
        } finally {
            persistence.close();
        }
    },
});

function eventIcon(type: string): string {
    if (type.startsWith('workflow:')) return pc.cyan('◆');
    if (type.startsWith('step:')) return pc.blue('▸');
    if (type.startsWith('directive:')) return pc.dim('·');
    if (type.startsWith('parallel:')) return pc.magenta('⫘');
    if (type === 'error') return pc.red('✗');
    return pc.dim('○');
}
