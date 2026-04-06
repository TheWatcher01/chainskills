/**
 * CLI command: `chainskills route --task <description>`
 *
 * Recommends which model to use for a given task based on historical data.
 *
 * @module cli/route
 */

import { defineCommand } from 'citty';
import { resolve, join } from 'node:path';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import pc from 'picocolors';
import { buildScorecard, classifyTask, recommend, type ScorecardEntry } from '#core/services/model-router.js';
import type { RouterConfig } from '#core/entities/model-router.js';

export const routeCommand = defineCommand({
    meta: {
        name: 'route',
        description: 'Recommend which model to use for a task',
    },
    args: {
        task: {
            type: 'string',
            description: 'Task description (used for classification)',
            required: true,
        },
        'task-type': {
            type: 'string',
            description: 'Override auto-classification with explicit task type',
            required: false,
        },
        input: {
            type: 'string',
            alias: 'i',
            description: 'Directory containing replay result JSON files',
            default: './replay-results',
        },
        'min-pass-rate': {
            type: 'string',
            default: '0.9',
        },
        json: {
            type: 'boolean',
            default: false,
        },
    },
    async run({ args }) {
        const inputDir = resolve(args.input);
        const jsonMode = args.json;
        const config: Partial<RouterConfig> = {
            minPassRate: parseFloat(args['min-pass-rate']),
        };

        // Classifier la tache
        const taskType = args['task-type'] ?? classifyTask(args.task);

        // Charger les entries
        const entries = loadEntries(inputDir);
        if (entries.length === 0) {
            if (jsonMode) {
                console.log(JSON.stringify({
                    taskType,
                    model: 'opus',
                    confidence: 0,
                    reason: 'No historical data — defaulting to most capable model',
                    fallbackChain: ['haiku', 'sonnet', 'opus'],
                    savingsVsExpensive: 0,
                }));
            } else {
                console.log(pc.yellow(`\n  No data in ${inputDir} — defaulting to opus`));
                console.log(pc.dim('  Run replay tasks and export results first.'));
            }
            return;
        }

        const scorecard = buildScorecard(entries, config);
        const rec = recommend(taskType, scorecard.metrics, config);

        if (jsonMode) {
            console.log(JSON.stringify({ classified: taskType, ...rec }, null, 2));
            return;
        }

        const confidenceColor = rec.confidence >= 0.8 ? pc.green : rec.confidence >= 0.5 ? pc.yellow : pc.red;

        console.log(pc.cyan('\n  chainskills route'));
        console.log(pc.dim('─'.repeat(55)));
        console.log(`  Task: ${pc.dim(args.task.slice(0, 60))}`);
        console.log(`  Classified as: ${pc.bold(taskType)}`);
        console.log(pc.dim('─'.repeat(55)));
        console.log(`  Recommendation:  ${pc.bold(rec.model.toUpperCase())}`);
        console.log(`  Confidence:      ${confidenceColor(Math.round(rec.confidence * 100) + '%')}`);
        console.log(`  Reason:          ${rec.reason}`);
        console.log(`  Fallback chain:  ${rec.fallbackChain.join(' → ')}`);
        if (rec.savingsVsExpensive > 0) {
            console.log(`  Savings vs opus: ${pc.green(rec.savingsVsExpensive + '%')}`);
        }
        console.log(pc.dim('─'.repeat(55)));
    },
});

function loadEntries(dir: string): ScorecardEntry[] {
    if (!existsSync(dir)) return [];
    const entries: ScorecardEntry[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
        try {
            const items = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
            for (const item of Array.isArray(items) ? items : [items]) {
                if (item.taskType && item.model && typeof item.pass === 'boolean') {
                    entries.push(item as ScorecardEntry);
                }
            }
        } catch { /* skip */ }
    }
    return entries;
}
