/**
 * CLI command: `chainskills history`
 *
 * Lists workflow execution history from the SQLite database.
 *
 * @module cli/history
 */

import { defineCommand } from 'citty';
import pc from 'picocolors';
import { createSqlitePersistence } from '#adapters/state/sqlite-persistence.js';
import { createSqliteRunHistory } from '#adapters/state/sqlite-run-history.js';

export const historyCommand = defineCommand({
    meta: {
        name: 'history',
        description: 'Show workflow execution history',
    },
    args: {
        runId: {
            type: 'positional',
            description: 'Show details for a specific run ID',
            required: false,
        },
        workflow: {
            type: 'string',
            alias: ['w'],
            description: 'Filter by workflow name',
            required: false,
        },
        failed: {
            type: 'boolean',
            description: 'Show only failed runs',
            default: false,
        },
        events: {
            type: 'boolean',
            alias: ['e'],
            description: 'Show events for a specific run',
            default: false,
        },
        limit: {
            type: 'string',
            alias: ['n'],
            description: 'Maximum number of runs to show',
            required: false,
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
            console.error(pc.red('No history database found. Run a workflow with --record first.'));
            process.exitCode = 1;
            return;
        }

        const history = createSqliteRunHistory(persistence);

        try {
            // Single run detail
            if (args.runId) {
                const run = history.getRun(args.runId);
                if (!run) {
                    console.error(pc.red(`Run not found: ${args.runId}`));
                    process.exitCode = 1;
                    return;
                }

                if (args.json) {
                    const events = args.events ? history.getEvents(args.runId) : undefined;
                    console.log(JSON.stringify({ run, events }, null, 2));
                    return;
                }

                console.log(pc.cyan('\n⟫ Run Details\n'));
                console.log(`  ${pc.bold('ID:')}        ${run.id}`);
                console.log(`  ${pc.bold('Workflow:')}  ${run.workflowName}`);
                if (run.workflowVersion) console.log(`  ${pc.bold('Version:')}   ${run.workflowVersion}`);
                console.log(`  ${pc.bold('Status:')}    ${statusColor(run.status)}`);
                console.log(`  ${pc.bold('Started:')}   ${run.startedAt}`);
                if (run.endedAt) console.log(`  ${pc.bold('Ended:')}     ${run.endedAt}`);
                if (run.durationMs) console.log(`  ${pc.bold('Duration:')}  ${run.durationMs}ms`);
                if (run.error) console.log(`  ${pc.bold('Error:')}     ${pc.red(run.error)}`);
                if (run.inputs) console.log(`  ${pc.bold('Inputs:')}    ${JSON.stringify(run.inputs)}`);
                if (run.outputs) console.log(`  ${pc.bold('Outputs:')}   ${JSON.stringify(run.outputs)}`);

                // Show events if requested
                if (args.events) {
                    const events = history.getEvents(args.runId);
                    console.log(`\n  ${pc.bold('Events:')} (${events.length})\n`);
                    for (const event of events) {
                        const stepStr = event.stepId ? pc.dim(` [${event.stepId}]`) : '';
                        console.log(`    ${pc.dim(event.timestamp)} ${event.eventType}${stepStr}`);
                    }
                }

                console.log('');
                return;
            }

            // List runs
            const runs = history.listRuns({
                workflowName: args.workflow,
                status: args.failed ? 'failed' : undefined,
                limit: args.limit ? Number(args.limit) : 20,
            });

            if (runs.length === 0) {
                if (args.json) {
                    console.log(JSON.stringify([]));
                } else {
                    console.log(pc.dim('No runs found'));
                }
                return;
            }

            if (args.json) {
                console.log(JSON.stringify(runs, null, 2));
                return;
            }

            console.log(pc.cyan('\n⟫ Run History\n'));

            for (const run of runs) {
                const statusStr = statusColor(run.status);
                const durationStr = run.durationMs ? pc.dim(`${run.durationMs}ms`) : '';
                const dateStr = pc.dim(run.startedAt.replace('T', ' ').slice(0, 19));
                console.log(`  ${statusStr} ${pc.bold(run.workflowName)} ${dateStr} ${durationStr}`);
                console.log(`    ${pc.dim(run.id)}`);
                if (run.error) console.log(`    ${pc.red(run.error.slice(0, 80))}`);
            }

            // Show success rates
            if (args.workflow) {
                const rate = history.getSuccessRate(args.workflow);
                console.log(`\n  ${pc.bold('Success rate:')} ${rate.success}/${rate.total} (${(rate.rate * 100).toFixed(0)}%)`);
            }

            console.log('');
        } finally {
            persistence.close();
        }
    },
});

function statusColor(status: string): string {
    switch (status) {
        case 'completed': return pc.green('✓');
        case 'failed': return pc.red('✗');
        case 'cancelled': return pc.yellow('⊘');
        case 'running': return pc.blue('⟳');
        default: return pc.dim('?');
    }
}
