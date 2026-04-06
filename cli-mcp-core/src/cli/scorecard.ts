/**
 * CLI command: `chainskills scorecard`
 *
 * Displays a comparative scorecard of model performance across task types.
 * Shows pass rate, cost, speed, and routing recommendations.
 *
 * @module cli/scorecard
 */

import { defineCommand } from 'citty';
import { resolve, join } from 'node:path';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import pc from 'picocolors';
import { buildScorecard, type ScorecardEntry } from '#core/services/model-router.js';
import type { RouterConfig } from '#core/entities/model-router.js';

export const scorecardCommand = defineCommand({
    meta: {
        name: 'scorecard',
        description: 'Display model performance scorecard with routing recommendations',
    },
    args: {
        input: {
            type: 'string',
            alias: 'i',
            description: 'Directory containing replay result JSON files',
            default: './replay-results',
        },
        'min-pass-rate': {
            type: 'string',
            description: 'Minimum pass rate to accept a model (0-1, default 0.9)',
            default: '0.9',
        },
        'min-runs': {
            type: 'string',
            description: 'Minimum runs before trusting metrics (default 3)',
            default: '3',
        },
        json: {
            type: 'boolean',
            description: 'Output as JSON',
            default: false,
        },
    },
    async run({ args }) {
        const inputDir = resolve(args.input);
        const jsonMode = args.json;
        const config: Partial<RouterConfig> = {
            minPassRate: parseFloat(args['min-pass-rate']),
            minRuns: parseInt(args['min-runs']),
        };

        // Charger les entries depuis les fichiers de resultats
        const entries = loadEntries(inputDir);

        if (entries.length === 0) {
            console.error(pc.red('No replay results found.'));
            console.error(pc.dim(`Expected JSON files in ${inputDir} with format:`));
            console.error(pc.dim('  { taskType, model, pass, duration_ms, tokens, cost_usd, toolCalls }'));
            console.error(pc.dim('\nOr run replay tasks first and export results.'));
            process.exit(1);
        }

        const scorecard = buildScorecard(entries, config);

        if (jsonMode) {
            console.log(JSON.stringify(scorecard, null, 2));
            return;
        }

        // Affichage tableau
        console.log(pc.cyan('\n  Model Scorecard'));
        console.log(pc.dim(`  ${scorecard.totalRuns} runs across ${scorecard.taskTypes.length} task types`));
        console.log(pc.dim('═'.repeat(78)));

        // En-tete
        const modelCols = scorecard.models.map((m) => m.padEnd(10)).join('');
        console.log(
            pc.bold('  Task Type'.padEnd(22)) +
            pc.bold(modelCols) +
            pc.bold('→ Route to'),
        );
        console.log(pc.dim('─'.repeat(78)));

        // Lignes par task type
        for (const taskType of scorecard.taskTypes) {
            let line = `  ${taskType.padEnd(22)}`;

            for (const model of scorecard.models) {
                const m = scorecard.metrics.find(
                    (met) => met.taskType === taskType && met.model === model,
                );
                if (!m) {
                    line += '-'.padEnd(10);
                } else {
                    const pct = `${Math.round(m.passRate * 100)}%`;
                    const color = m.passRate >= 0.9 ? pc.green : m.passRate >= 0.7 ? pc.yellow : pc.red;
                    line += color(pct.padEnd(10));
                }
            }

            // Recommendation
            const rec = scorecard.recommendations.find((r) => r.taskType === taskType);
            if (rec) {
                const savingsStr = rec.savingsVsExpensive > 0 ? ` (${rec.savingsVsExpensive}% cheaper)` : '';
                line += pc.bold(`→ ${rec.model}`) + pc.dim(savingsStr);
            }

            console.log(line);
        }

        console.log(pc.dim('═'.repeat(78)));
        console.log(pc.green(`  Estimated savings: ${scorecard.estimatedSavings}% of tasks routable to cheaper models`));
    },
});

/** Load scorecard entries from JSON files in a directory. */
function loadEntries(dir: string): ScorecardEntry[] {
    if (!existsSync(dir)) return [];

    const entries: ScorecardEntry[] = [];
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
        try {
            const content = readFileSync(join(dir, file), 'utf-8');
            const parsed = JSON.parse(content);

            // Accepter un array d'entries ou un objet unique
            const items = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of items) {
                if (item.taskType && item.model && typeof item.pass === 'boolean') {
                    entries.push({
                        taskType: item.taskType,
                        difficulty: item.difficulty ?? 'medium',
                        model: item.model,
                        pass: item.pass,
                        duration_ms: item.duration_ms ?? 0,
                        tokens: item.tokens ?? 0,
                        cost_usd: item.cost_usd ?? 0,
                        toolCalls: item.toolCalls ?? 0,
                    });
                }
            }
        } catch {
            // Skip invalid files
        }
    }

    return entries;
}
