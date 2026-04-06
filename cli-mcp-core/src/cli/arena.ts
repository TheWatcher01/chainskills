/**
 * CLI command: `chainskills arena <workflow> --models m1,m2 --rounds 5`
 *
 * Blind comparison arena — executes workflow on pairs of models,
 * presents anonymized outputs, and collects human votes.
 * Computes Elo ratings from votes.
 *
 * @module cli/arena
 */

import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import pc from 'picocolors';
import * as clack from '@clack/prompts';
import { createContainer } from '#config/container.js';
import { runWorkflow } from '#core/use-cases/run-workflow.js';
import { initializeElo, updateElo, rankModels } from '#core/services/elo-rating.js';
import type { ArenaVote, ArenaReport } from '#core/entities/arena-config.js';

export const arenaCommand = defineCommand({
    meta: {
        name: 'arena',
        description: 'Blind comparison arena — vote between anonymous LLM outputs',
    },
    args: {
        workflow: {
            type: 'positional',
            description: 'Path to the .workflow.md file',
            required: true,
        },
        models: {
            type: 'string',
            description: 'Comma-separated model list (min 2)',
            required: true,
        },
        rounds: {
            type: 'string',
            description: 'Number of voting rounds (default 5)',
            default: '5',
        },
        input: {
            type: 'string',
            description: 'Input variables as key=value',
            required: false,
        },
        output: {
            type: 'string',
            description: 'Save arena report to JSON file',
            required: false,
        },
        json: {
            type: 'boolean',
            description: 'Output as JSON (non-interactive, requires pre-recorded votes)',
            default: false,
        },
    },
    async run({ args }) {
        const workflowPath = resolve(args.workflow);
        const models = args.models.split(',').map((m) => m.trim()).filter(Boolean);
        const totalRounds = Number(args.rounds) || 5;
        const outputPath = args.output;
        const jsonMode = args.json;

        if (models.length < 2) {
            console.error(pc.red('Arena requires at least 2 models.'));
            process.exit(1);
        }

        // Parse inputs
        const inputs: Record<string, string> = {};
        if (args.input) {
            for (const pair of args.input.split(',')) {
                const [key, ...valueParts] = pair.split('=');
                if (key) inputs[key.trim()] = valueParts.join('=').trim();
            }
        }

        if (!jsonMode) {
            clack.intro(pc.cyan('chainskills arena — blind model comparison'));
            clack.log.info(`Workflow: ${args.workflow}`);
            clack.log.info(`Models: ${models.join(', ')} (anonymized during voting)`);
            clack.log.info(`Rounds: ${totalRounds}`);
        }

        const eloRatings = initializeElo(models);
        const votes: ArenaVote[] = [];
        const modelStats: Record<string, { wins: number; losses: number; ties: number }> = {};
        for (const m of models) {
            modelStats[m] = { wins: 0, losses: 0, ties: 0 };
        }

        // Generate model pairs (round-robin)
        const pairs: Array<[string, string]> = [];
        for (let i = 0; i < models.length; i++) {
            for (let j = i + 1; j < models.length; j++) {
                pairs.push([models[i]!, models[j]!]);
            }
        }

        for (let round = 0; round < totalRounds; round++) {
            const [modelA, modelB] = pairs[round % pairs.length]!;

            if (!jsonMode) {
                clack.log.step(`Round ${round + 1}/${totalRounds}`);
            }

            // Execute workflow with model A
            const prevModel = process.env['AGENT_MODEL'];

            process.env['AGENT_MODEL'] = modelA;
            const containerA = await createContainer({ logLevel: 'warn' });
            const resultA = await runWorkflow(workflowPath, containerA, { inputs });

            process.env['AGENT_MODEL'] = modelB;
            const containerB = await createContainer({ logLevel: 'warn' });
            const resultB = await runWorkflow(workflowPath, containerB, { inputs });

            // Restore env
            if (prevModel !== undefined) process.env['AGENT_MODEL'] = prevModel;
            else delete process.env['AGENT_MODEL'];

            const outputA = resultA.ok ? resultA.value.execution.outputs : { error: resultA.error.message };
            const outputB = resultB.ok ? resultB.value.execution.outputs : { error: resultB.error.message };

            // Randomize presentation order
            const swap = Math.random() > 0.5;
            const candidateA = swap ? outputB : outputA;
            const candidateB = swap ? outputA : outputB;
            let winner: 'A' | 'B' | 'tie';

            if (jsonMode) {
                // Non-interactive: auto-tie
                winner = 'tie';
            } else {
                // Show outputs
                console.log(pc.yellow('\n── Candidate A ──'));
                console.log(JSON.stringify(candidateA, null, 2));
                console.log(pc.yellow('\n── Candidate B ──'));
                console.log(JSON.stringify(candidateB, null, 2));

                const voteResult = await clack.select({
                    message: 'Which output is better?',
                    options: [
                        { value: 'A', label: 'Candidate A' },
                        { value: 'B', label: 'Candidate B' },
                        { value: 'tie', label: 'Tie / Both equal' },
                    ],
                });

                if (clack.isCancel(voteResult)) {
                    clack.cancel('Arena cancelled.');
                    process.exit(0);
                }

                winner = voteResult as 'A' | 'B' | 'tie';
            }

            // Map vote back to actual models (undo swap)
            const actualWinner = swap
                ? (winner === 'A' ? 'B' : winner === 'B' ? 'A' : 'tie')
                : winner;

            // Update Elo
            const { newRatingA, newRatingB } = updateElo(
                eloRatings[modelA]!, eloRatings[modelB]!, actualWinner,
            );
            eloRatings[modelA] = newRatingA;
            eloRatings[modelB] = newRatingB;

            // Update stats
            if (actualWinner === 'A') {
                modelStats[modelA]!.wins++;
                modelStats[modelB]!.losses++;
            } else if (actualWinner === 'B') {
                modelStats[modelB]!.wins++;
                modelStats[modelA]!.losses++;
            } else {
                modelStats[modelA]!.ties++;
                modelStats[modelB]!.ties++;
            }

            votes.push({
                roundIndex: round,
                modelA,
                modelB,
                outputA,
                outputB,
                winner: actualWinner,
                timestamp: new Date().toISOString(),
            });
        }

        // Build report
        const report: ArenaReport = {
            workflow: args.workflow,
            models,
            totalRounds,
            votes,
            eloRatings,
            stats: modelStats,
            timestamp: new Date().toISOString(),
        };

        // Save report
        if (outputPath) {
            writeFileSync(resolve(outputPath), JSON.stringify(report, null, 2), 'utf-8');
        }

        // Display results
        if (jsonMode) {
            console.log(JSON.stringify(report, null, 2));
        } else {
            const ranked = rankModels(eloRatings);
            console.log(pc.cyan('\n⟫ Arena Results'));
            console.log(pc.dim('─'.repeat(60)));
            console.log(
                pc.bold('  Rank  Model'.padEnd(35)) +
                pc.bold('Elo'.padEnd(8)) +
                pc.bold('W/L/T'),
            );
            console.log(pc.dim('─'.repeat(60)));

            ranked.forEach(({ model, elo }, i) => {
                const s = modelStats[model]!;
                const medal = i === 0 ? ' 1st' : i === 1 ? ' 2nd' : i === 2 ? ' 3rd' : `${i + 1}th`;
                console.log(
                    `  ${medal.padEnd(4)} ${model.padEnd(28)} ${String(elo).padEnd(8)} ${s.wins}/${s.losses}/${s.ties}`,
                );
            });

            if (outputPath) {
                console.log(pc.green(`\nReport saved: ${outputPath}`));
            }
            clack.outro('Arena complete!');
        }
    },
});
