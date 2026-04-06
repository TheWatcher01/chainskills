/**
 * CLI command: `chainskills bench-suite --suite <dir> --models <list>`
 *
 * Runs the full benchmark suite across models, generating an aggregated report
 * with per-domain, per-difficulty, and per-model metrics.
 *
 * @module cli/bench-suite
 */

import { defineCommand } from 'citty';
import { resolve, relative, basename, dirname } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import pc from 'picocolors';
import { createContainer } from '#config/container.js';
import { runWorkflow } from '#core/use-cases/run-workflow.js';
import { loadGoldenFile, compareWithGolden } from '#adapters/golden/golden-loader.js';
import type { BenchRunResult, BenchReport, GoldenFile } from '#core/entities/bench-config.js';
import type {
    BenchWorkflowMeta,
    BenchDomain,
    BenchDifficulty,
    SuiteResult,
    SuiteModelMetrics,
} from '#core/entities/benchmark-suite.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Recursively find all .workflow.md files under a directory. */
function findWorkflows(dir: string): string[] {
    const results: string[] = [];
    if (!existsSync(dir)) return results;

    for (const entry of readdirSync(dir)) {
        const full = resolve(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            results.push(...findWorkflows(full));
        } else if (entry.endsWith('.workflow.md')) {
            results.push(full);
        }
    }
    return results;
}

/** Extract benchmark metadata from a workflow's frontmatter. */
function extractMeta(path: string, suiteDir: string): BenchWorkflowMeta | null {
    try {
        const content = readFileSync(path, 'utf-8');
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) return null;

        const fm = fmMatch[1] ?? '';
        const get = (key: string): string | undefined => {
            const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
            return m?.[1]?.trim();
        };

        const name = get('name') ?? basename(path, '.workflow.md');
        const domain = get('domain') as BenchDomain | undefined;
        const difficulty = get('difficulty') as BenchDifficulty | undefined;
        const description = get('description') ?? '';

        if (!domain || !difficulty) {
            // Infer from path: benchmarks/coding/easy/foo.workflow.md
            const rel = relative(suiteDir, path);
            const parts = rel.split('/');
            const inferredDomain = (parts[0] ?? domain) as BenchDomain;
            const inferredDifficulty = (parts[1] ?? difficulty) as BenchDifficulty;

            if (!inferredDomain || !inferredDifficulty) return null;

            return {
                path,
                name,
                domain: inferredDomain,
                difficulty: inferredDifficulty,
                description,
                goldenPath: findGoldenFile(path),
            };
        }

        return {
            path,
            name,
            domain,
            difficulty,
            description,
            goldenPath: findGoldenFile(path),
        };
    } catch {
        return null;
    }
}

/** Find a golden file next to the workflow (name.golden.json). */
function findGoldenFile(workflowPath: string): string | undefined {
    const dir = dirname(workflowPath);
    const base = basename(workflowPath, '.workflow.md');
    const goldenPath = resolve(dir, `${base}.golden.json`);
    return existsSync(goldenPath) ? goldenPath : undefined;
}

// ─── Command ────────────────────────────────────────────────────────────────

export const benchSuiteCommand = defineCommand({
    meta: {
        name: 'bench-suite',
        description: 'Run the full benchmark suite across models',
    },
    args: {
        suite: {
            type: 'string',
            description: 'Path to the benchmark suite directory',
            default: './benchmarks',
        },
        models: {
            type: 'string',
            description: 'Comma-separated model list (e.g., claude-sonnet,gpt-4o,qwen3.5)',
            required: true,
        },
        runs: {
            type: 'string',
            description: 'Number of runs per model per workflow (default 1)',
            default: '1',
        },
        domain: {
            type: 'string',
            description: 'Filter by domain (coding, data, security, writing, reasoning, tool-use)',
            required: false,
        },
        difficulty: {
            type: 'string',
            description: 'Filter by difficulty (easy, medium, hard)',
            required: false,
        },
        output: {
            type: 'string',
            description: 'Output directory for results (default ./bench-results)',
            default: './bench-results',
        },
        'dry-run': {
            type: 'boolean',
            description: 'Run without LLM calls (test suite discovery)',
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
        const suiteDir = resolve(args.suite);
        const models = args.models.split(',').map((m) => m.trim()).filter(Boolean);
        const runsPerModel = Number(args.runs) || 1;
        const domainFilter = args.domain as BenchDomain | undefined;
        const difficultyFilter = args.difficulty as BenchDifficulty | undefined;
        const outputDir = resolve(args.output);
        const dryRun = args['dry-run'];
        const jsonMode = args.json;
        const verbose = args.verbose;

        // 1. Discover workflows
        if (!existsSync(suiteDir)) {
            console.error(pc.red(`Suite directory not found: ${suiteDir}`));
            process.exit(1);
        }

        const workflowPaths = findWorkflows(suiteDir);
        const allMeta = workflowPaths
            .map((p) => extractMeta(p, suiteDir))
            .filter((m): m is BenchWorkflowMeta => m !== null);

        // 2. Apply filters
        let filtered = allMeta;
        if (domainFilter) {
            filtered = filtered.filter((m) => m.domain === domainFilter);
        }
        if (difficultyFilter) {
            filtered = filtered.filter((m) => m.difficulty === difficultyFilter);
        }

        if (filtered.length === 0) {
            console.error(pc.red('No benchmark workflows found matching filters'));
            process.exit(1);
        }

        if (!jsonMode) {
            console.log(pc.cyan(`\n  chainskills bench-suite v1.0`));
            console.log(pc.dim('─'.repeat(70)));
            console.log(`  Suite: ${suiteDir}`);
            console.log(`  Workflows: ${filtered.length} / ${allMeta.length} total`);
            console.log(`  Models: ${models.join(', ')}`);
            console.log(`  Runs per model: ${runsPerModel}`);
            if (domainFilter) console.log(`  Domain filter: ${domainFilter}`);
            if (difficultyFilter) console.log(`  Difficulty filter: ${difficultyFilter}`);
            if (dryRun) console.log(pc.yellow('  Mode: DRY-RUN (no LLM calls)'));
            console.log(pc.dim('─'.repeat(70)));
        }

        // 3. Execute benchmarks
        const startedAt = new Date().toISOString();
        const allRuns: BenchRunResult[] = [];
        const reports: BenchReport[] = [];

        for (const meta of filtered) {
            if (!jsonMode) {
                console.log(pc.yellow(`\n  [${meta.domain}/${meta.difficulty}] ${meta.name}`));
            }

            // Load golden file if present
            let golden: GoldenFile | null = null;
            if (meta.goldenPath) {
                const goldenResult = await loadGoldenFile(meta.goldenPath);
                if (goldenResult.ok) {
                    golden = goldenResult.value as GoldenFile;
                }
            }

            const workflowRuns: BenchRunResult[] = [];

            for (const model of models) {
                for (let i = 0; i < runsPerModel; i++) {
                    const prevModel = process.env['AGENT_MODEL'];
                    process.env['AGENT_MODEL'] = model;

                    const container = await createContainer({
                        logLevel: verbose ? 'debug' : 'warn',
                        executor: 'simple',
                        tracesDir: `/tmp/cs-bench-${Date.now()}`,
                    });

                    const startTime = Date.now();
                    const result = await runWorkflow(meta.path, container, {
                        inputs: meta.inputs ?? {},
                        dryRun,
                    });
                    const duration = Date.now() - startTime;

                    // Restore env
                    if (prevModel !== undefined) {
                        process.env['AGENT_MODEL'] = prevModel;
                    } else {
                        delete process.env['AGENT_MODEL'];
                    }

                    const run: BenchRunResult = result.ok
                        ? {
                            model,
                            runIndex: i,
                            duration_ms: duration,
                            success: true,
                            outputs: result.value.execution.outputs,
                            goldenPass: golden ? compareWithGolden(result.value.execution.outputs, golden).pass : undefined,
                            goldenFailures: golden ? compareWithGolden(result.value.execution.outputs, golden).failures : undefined,
                        }
                        : {
                            model,
                            runIndex: i,
                            duration_ms: duration,
                            success: false,
                            outputs: {},
                            error: result.error.message,
                            goldenPass: false,
                        };

                    workflowRuns.push(run);
                    allRuns.push(run);

                    if (!jsonMode) {
                        const status = run.success ? pc.green('  ✓') : pc.red('  ✗');
                        const goldenStr = run.goldenPass === true ? pc.green(' GOLDEN') : run.goldenPass === false ? pc.red(' GOLDEN-FAIL') : '';
                        console.log(`${status} ${model} #${i + 1}: ${duration}ms${goldenStr}`);
                    }
                }
            }

            // Build per-workflow report
            const summary: BenchReport['summary'] = {};
            for (const model of models) {
                const modelRuns = workflowRuns.filter((r) => r.model === model);
                const successRuns = modelRuns.filter((r) => r.success);
                const totalDuration = modelRuns.reduce((sum, r) => sum + r.duration_ms, 0);
                const goldenPasses = modelRuns.filter((r) => r.goldenPass === true).length;

                summary[model] = {
                    avgDuration_ms: Math.round(totalDuration / modelRuns.length),
                    successRate: successRuns.length / modelRuns.length,
                    goldenPassRate: golden ? goldenPasses / modelRuns.length : undefined,
                };
            }

            reports.push({
                workflow: meta.name,
                models: [...models],
                runsPerModel,
                goldenFile: meta.goldenPath,
                summary,
                runs: workflowRuns,
                timestamp: new Date().toISOString(),
            });
        }

        // 4. Compute per-model aggregated metrics
        const completedAt = new Date().toISOString();
        const modelMetrics: SuiteModelMetrics[] = models.map((model) => {
            const modelRuns = allRuns.filter((r) => r.model === model);
            const successRuns = modelRuns.filter((r) => r.success);
            const totalDuration = modelRuns.reduce((sum, r) => sum + r.duration_ms, 0);
            const totalTokens = modelRuns.reduce((sum, r) => sum + (r.tokens?.prompt ?? 0) + (r.tokens?.completion ?? 0), 0);
            const goldenPasses = modelRuns.filter((r) => r.goldenPass === true).length;
            const hasGolden = modelRuns.some((r) => r.goldenPass !== undefined);

            // Per-domain breakdown
            const domains = {} as Record<BenchDomain, { passed: number; total: number; avgDuration_ms: number }>;
            for (const meta of filtered) {
                if (!domains[meta.domain]) {
                    domains[meta.domain] = { passed: 0, total: 0, avgDuration_ms: 0 };
                }
                // Count from per-workflow reports
                const report = reports.find((rep) => rep.workflow === meta.name);
                if (report) {
                    const s = report.summary[model];
                    if (s) {
                        domains[meta.domain].total++;
                        if (s.successRate > 0.5) domains[meta.domain].passed++;
                        domains[meta.domain].avgDuration_ms += s.avgDuration_ms;
                    }
                }
            }
            // Average the durations
            for (const d of Object.values(domains)) {
                if (d.total > 0) d.avgDuration_ms = Math.round(d.avgDuration_ms / d.total);
            }

            // Per-difficulty breakdown
            const difficulties = {} as Record<BenchDifficulty, { passed: number; total: number }>;
            for (const meta of filtered) {
                if (!difficulties[meta.difficulty]) {
                    difficulties[meta.difficulty] = { passed: 0, total: 0 };
                }
                const report = reports.find((rep) => rep.workflow === meta.name);
                if (report) {
                    const s = report.summary[model];
                    if (s) {
                        difficulties[meta.difficulty].total++;
                        if (s.successRate > 0.5) difficulties[meta.difficulty].passed++;
                    }
                }
            }

            return {
                model,
                totalWorkflows: filtered.length,
                passed: successRuns.length,
                avgDuration_ms: modelRuns.length > 0 ? Math.round(totalDuration / modelRuns.length) : 0,
                successRate: modelRuns.length > 0 ? successRuns.length / modelRuns.length : 0,
                goldenPassRate: hasGolden ? goldenPasses / modelRuns.length : undefined,
                totalTokens,
                estimatedCost_usd: 0, // Computed externally based on model pricing
                domains,
                difficulties,
            };
        });

        const suiteResult: SuiteResult = {
            suiteVersion: '1.0.0',
            suiteDir,
            workflowCount: allMeta.length,
            filteredCount: filtered.length,
            models: [...models],
            runsPerModel,
            modelMetrics,
            reports,
            runs: allRuns,
            startedAt,
            completedAt,
            totalDuration_ms: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
            filters: {
                domain: domainFilter,
                difficulty: difficultyFilter,
            },
        };

        // 5. Save results
        mkdirSync(outputDir, { recursive: true });
        const reportPath = resolve(outputDir, `suite-result-${Date.now()}.json`);
        writeFileSync(reportPath, JSON.stringify(suiteResult, null, 2), 'utf-8');

        // 6. Display summary
        if (jsonMode) {
            console.log(JSON.stringify(suiteResult, null, 2));
        } else {
            console.log(pc.cyan('\n  Suite Results'));
            console.log(pc.dim('─'.repeat(70)));
            console.log(
                pc.bold('  Model'.padEnd(28)) +
                pc.bold('Pass'.padEnd(8)) +
                pc.bold('Rate'.padEnd(8)) +
                pc.bold('Avg ms'.padEnd(10)) +
                pc.bold('Golden'.padEnd(10)) +
                pc.bold('Tokens'),
            );
            console.log(pc.dim('─'.repeat(70)));

            for (const m of modelMetrics) {
                const pass = `${m.passed}/${m.totalWorkflows * runsPerModel}`;
                const rate = `${Math.round(m.successRate * 100)}%`;
                const dur = `${m.avgDuration_ms}`;
                const golden = m.goldenPassRate !== undefined ? `${Math.round(m.goldenPassRate * 100)}%` : 'n/a';
                const tokens = m.totalTokens > 0 ? `${m.totalTokens}` : 'n/a';

                console.log(
                    `  ${m.model.padEnd(28)}${pass.padEnd(8)}${rate.padEnd(8)}${dur.padEnd(10)}${golden.padEnd(10)}${tokens}`,
                );
            }

            console.log(pc.dim('─'.repeat(70)));
            console.log(pc.green(`  Report saved to: ${reportPath}`));
            console.log(`  Duration: ${suiteResult.totalDuration_ms}ms`);
        }
    },
});
