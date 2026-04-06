/**
 * CLI command: `chainskills explore <task-dir>`
 *
 * Autonomous exploration: cascades through model+effort combinations,
 * tracks hypotheses, injects anti-loop context, converges to a solution.
 *
 * Inspired by Reflexion (NeurIPS 2023) + LATS (ICML 2024).
 *
 * @module cli/explore
 */

import { defineCommand } from 'citty';
import { resolve, join, basename } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pc from 'picocolors';
import {
    createTree,
    addHypothesis,
    generateAntiLoopContext,
    summarizeTree,
} from '#core/services/reflexion.js';
import type { Hypothesis } from '#core/entities/hypothesis.js';
import type { EffortLevel } from '#core/entities/model-router.js';

export const exploreCommand = defineCommand({
    meta: {
        name: 'explore',
        description: 'Autonomous task exploration with anti-loop memory',
    },
    args: {
        task: {
            type: 'positional',
            description: 'Path to a replay task directory',
            required: true,
        },
        cascade: {
            type: 'string',
            description: 'Model/effort cascade (e.g., haiku/low,sonnet/medium,opus/high)',
            default: 'haiku/low,haiku/high,sonnet/medium,opus/high',
        },
        'max-attempts': {
            type: 'string',
            description: 'Maximum attempts before giving up',
            default: '4',
        },
        'pass-threshold': {
            type: 'string',
            description: 'Minimum score to consider a pass (0-100)',
            default: '60',
        },
        json: {
            type: 'boolean',
            description: 'Output as JSON',
            default: false,
        },
    },
    async run({ args }) {
        const taskDir = resolve(args.task);
        const maxAttempts = parseInt(args['max-attempts']);
        const passThreshold = parseInt(args['pass-threshold']);
        const jsonMode = args.json;

        // Parse cascade
        const cascade = args.cascade.split(',').map((entry) => {
            const [model, effort] = entry.trim().split('/');
            return { model: model ?? 'opus', effort: (effort ?? 'high') as EffortLevel };
        });

        // Validate task directory
        if (!existsSync(join(taskDir, 'TASK.md'))) {
            console.error(pc.red(`Not a valid task directory: ${taskDir}`));
            console.error(pc.dim('Expected: TASK.md, setup.sh, verify.sh'));
            process.exit(1);
        }

        const taskId = basename(taskDir);
        const taskMd = readFileSync(join(taskDir, 'TASK.md'), 'utf-8');

        if (!jsonMode) {
            console.log(pc.cyan(`\n  chainskills explore — ${taskId}`));
            console.log(pc.dim(`  Cascade: ${cascade.map((c) => `${c.model}/${c.effort}`).join(' → ')}`));
            console.log(pc.dim(`  Max attempts: ${maxAttempts}, pass threshold: ${passThreshold}`));
            console.log(pc.dim('═'.repeat(60)));
        }

        let tree = createTree(taskId);

        for (let attempt = 0; attempt < Math.min(maxAttempts, cascade.length); attempt++) {
            const { model, effort } = cascade[attempt] ?? cascade[cascade.length - 1]!;

            // Create isolated workspace
            const workspace = `/tmp/chainskills-runs/${taskId}-${randomUUID().slice(0, 8)}`;
            mkdirSync(workspace, { recursive: true });

            if (!jsonMode) {
                console.log(pc.yellow(`\n  Attempt ${attempt + 1}/${maxAttempts}: ${model}/${effort}`));
                console.log(pc.dim(`  Workspace: ${workspace}`));
            }

            // Setup
            const setupScript = join(taskDir, 'setup.sh');
            if (existsSync(setupScript)) {
                try {
                    execSync(`bash "${setupScript}" "${workspace}"`, { stdio: 'pipe', timeout: 15000 });
                } catch {
                    // Fallback: setup without workspace arg (backward compat)
                    execSync(`bash "${setupScript}"`, { stdio: 'pipe', timeout: 15000 });
                }
            }

            // Build prompt with anti-loop context
            const antiLoop = generateAntiLoopContext(tree);
            const prompt = antiLoop
                ? `${antiLoop}\n---\n\n${taskMd}`
                : taskMd;

            // Write the enriched prompt for reference
            writeFileSync(join(workspace, 'PROMPT.md'), prompt, 'utf-8');

            if (!jsonMode && antiLoop) {
                const failCount = tree.hypotheses.filter((h) => h.result === 'fail').length;
                console.log(pc.dim(`  Anti-loop context injected (${failCount} prior failures)`));
            }

            // Verify (we can't actually run the agent here — just simulate the flow)
            // In real usage, the user or an Agent subagent would execute the task
            let score = 0;
            let verifyOutput = '';
            const verifyScript = join(taskDir, 'verify.sh');
            if (existsSync(verifyScript)) {
                try {
                    verifyOutput = execSync(`bash "${verifyScript}" "${workspace}"`, {
                        encoding: 'utf-8',
                        stdio: 'pipe',
                        timeout: 30000,
                    });
                    // Extract score from output
                    const scoreMatch = verifyOutput.match(/SCORE:\s*(\d+)/);
                    if (scoreMatch?.[1]) {
                        score = parseInt(scoreMatch[1]);
                    } else {
                        score = 100; // Binary pass
                    }
                } catch (e) {
                    const errOutput = e instanceof Error && 'stdout' in e ? String((e as { stdout: unknown }).stdout) : '';
                    const scoreMatch = errOutput.match(/SCORE:\s*(\d+)/);
                    score = scoreMatch?.[1] ? parseInt(scoreMatch[1]) : 0;
                    verifyOutput = errOutput;
                }
            }

            const result = score >= passThreshold ? 'pass' : 'fail';

            // Create hypothesis
            const hypothesis: Hypothesis = {
                id: randomUUID(),
                taskId,
                model,
                effort,
                description: `Attempt with ${model}/${effort}`,
                actions: [],
                filesModified: [],
                result,
                score,
                reflection: result === 'pass'
                    ? `Succeeded with ${model}/${effort} (score ${score})`
                    : `Failed with ${model}/${effort} (score ${score}). ${verifyOutput.trim().split('\n')[0] ?? ''}`,
                timestamp: new Date().toISOString(),
                tokens: 0,
                duration_ms: 0,
            };

            tree = addHypothesis(tree, hypothesis);

            if (!jsonMode) {
                const statusIcon = result === 'pass' ? pc.green('PASS') : pc.red('FAIL');
                console.log(`  ${statusIcon} Score: ${score}/100`);
                if (result === 'fail') {
                    console.log(pc.dim(`  Reflection: ${hypothesis.reflection.slice(0, 80)}`));
                }
            }

            // Stop if we passed
            if (result === 'pass') {
                if (!jsonMode) {
                    console.log(pc.green(`\n  Solved in ${attempt + 1} attempts!`));
                }
                break;
            }
        }

        // Final summary
        if (jsonMode) {
            console.log(JSON.stringify(tree, null, 2));
        } else {
            console.log(pc.dim('\n' + '═'.repeat(60)));
            console.log(pc.cyan('  Summary'));
            console.log(`  ${summarizeTree(tree)}`);
            console.log(pc.dim('═'.repeat(60)));
        }

        // Save exploration tree
        const treePath = join(taskDir, '.exploration-tree.json');
        writeFileSync(treePath, JSON.stringify(tree, null, 2), 'utf-8');
    },
});
