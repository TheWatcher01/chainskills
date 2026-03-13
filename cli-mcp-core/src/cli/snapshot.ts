/**
 * CLI command: `chainskills snapshot`
 *
 * List, inspect, or restore snapshots from recorded runs.
 *
 * @module cli/snapshot
 */

import { defineCommand } from 'citty';
import pc from 'picocolors';
import { createSqlitePersistence } from '#adapters/state/sqlite-persistence.js';
import { createSqliteSnapshotManager } from '#adapters/state/sqlite-snapshot-manager.js';

export const snapshotCommand = defineCommand({
    meta: {
        name: 'snapshot',
        description: 'List, inspect, or restore workflow state snapshots',
    },
    args: {
        runId: {
            type: 'positional',
            description: 'Run ID to show snapshots for',
            required: true,
        },
        inspect: {
            type: 'string',
            description: 'Snapshot ID to inspect (show full state)',
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
            console.error(pc.red('No history database found.'));
            process.exitCode = 1;
            return;
        }

        const snapshots = createSqliteSnapshotManager(persistence);

        try {
            // Inspect a specific snapshot
            if (args.inspect) {
                const snapshot = snapshots.load(Number(args.inspect));
                if (!snapshot) {
                    console.error(pc.red(`Snapshot not found: ${args.inspect}`));
                    process.exitCode = 1;
                    return;
                }

                if (args.json) {
                    console.log(JSON.stringify(snapshot, null, 2));
                    return;
                }

                console.log(pc.cyan('\n⟫ Snapshot Details\n'));
                console.log(`  ${pc.bold('ID:')}      ${snapshot.id}`);
                console.log(`  ${pc.bold('Run:')}     ${snapshot.runId}`);
                console.log(`  ${pc.bold('Label:')}   ${snapshot.label}`);
                if (snapshot.stepId) console.log(`  ${pc.bold('Step:')}    ${snapshot.stepId}`);
                console.log(`  ${pc.bold('Created:')} ${snapshot.createdAt}`);
                console.log(`\n  ${pc.bold('State:')}`);
                console.log(`    ${JSON.stringify(snapshot.state, null, 2).split('\n').join('\n    ')}`);
                console.log('');
                return;
            }

            // List snapshots for a run
            const list = snapshots.listByRun(args.runId);

            if (list.length === 0) {
                if (args.json) {
                    console.log(JSON.stringify([]));
                } else {
                    console.log(pc.dim('No snapshots found for this run'));
                }
                return;
            }

            if (args.json) {
                console.log(JSON.stringify(list, null, 2));
                return;
            }

            console.log(pc.cyan('\n⟫ Snapshots\n'));

            for (const snap of list) {
                const stepStr = snap.stepId ? pc.dim(` [${snap.stepId}]`) : '';
                const stateKeys = Object.keys(snap.state).length;
                console.log(`  ${pc.bold(String(snap.id))} ${pc.green(snap.label)}${stepStr} ${pc.dim(`(${stateKeys} vars)`)}`);
                console.log(`    ${pc.dim(snap.createdAt)}`);
            }

            console.log('');
        } finally {
            persistence.close();
        }
    },
});
