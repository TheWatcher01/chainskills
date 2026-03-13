/**
 * CLI command: `chainskills rules`
 *
 * List, inspect, or delete learned rules from workflow reflections.
 *
 * @module cli/rules
 */

import { defineCommand } from 'citty';
import pc from 'picocolors';
import { createSqlitePersistence } from '#adapters/state/sqlite-persistence.js';
import { createSqliteRulesStore } from '#adapters/state/sqlite-rules-store.js';

export const rulesCommand = defineCommand({
    meta: {
        name: 'rules',
        description: 'List, inspect, or manage learned workflow rules',
    },
    args: {
        workflow: {
            type: 'string',
            alias: ['w'],
            description: 'Filter by workflow name',
            required: false,
        },
        type: {
            type: 'string',
            alias: ['t'],
            description: 'Filter by rule type (soft|hard)',
            required: false,
        },
        delete: {
            type: 'string',
            alias: ['d'],
            description: 'Delete a rule by ID',
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
            console.error(pc.red('No database found. Run a workflow with @reflect first.'));
            process.exitCode = 1;
            return;
        }

        const rules = createSqliteRulesStore(persistence);

        try {
            // Delete a rule
            if (args.delete) {
                const id = Number(args.delete);
                rules.deleteRule(id);
                console.log(pc.green(`Rule ${id} deleted.`));
                return;
            }

            // List rules
            const ruleType = args.type as 'soft' | 'hard' | undefined;
            const list = rules.listAll({
                workflowName: args.workflow,
                ruleType,
            });

            if (list.length === 0) {
                if (args.json) {
                    console.log(JSON.stringify([]));
                } else {
                    console.log(pc.dim('No rules found'));
                }
                return;
            }

            if (args.json) {
                console.log(JSON.stringify(list, null, 2));
                return;
            }

            console.log(pc.cyan('\n⟫ Learned Rules\n'));

            for (const rule of list) {
                const typeIcon = rule.ruleType === 'hard' ? pc.red('◆') : pc.blue('○');
                const confStr = pc.dim(`[${(rule.confidence * 100).toFixed(0)}%]`);
                const wfStr = rule.workflowName ? pc.dim(` (${rule.workflowName})`) : pc.dim(' (global)');
                const hitsStr = rule.hitCount > 0 ? pc.dim(` ×${rule.hitCount}`) : '';

                console.log(`  ${typeIcon} ${pc.bold(String(rule.id))} ${confStr}${wfStr}${hitsStr}`);
                console.log(`    ${pc.green('IF')}   ${rule.condition}`);
                console.log(`    ${pc.yellow('THEN')} ${rule.action}`);
                if (rule.source) console.log(`    ${pc.dim(`src: ${rule.source}`)}`);
                console.log('');
            }
        } finally {
            persistence.close();
        }
    },
});
