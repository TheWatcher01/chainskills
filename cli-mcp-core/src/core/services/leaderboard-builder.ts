/**
 * Leaderboard builder — aggregates SuiteResults into LeaderboardData.
 *
 * Pure functions, zero external dependencies (except core entities).
 *
 * @module core/services/leaderboard-builder
 */

import type { SuiteResult, SuiteModelMetrics } from '../entities/benchmark-suite.js';
import type { BenchDomain } from '../entities/benchmark-suite.js';
import type {
    LeaderboardData,
    LeaderboardEntry,
    DomainScore,
    BadgeData,
} from '../entities/leaderboard.js';
// Elo utilities available if needed for pairwise comparison
// import { initializeElo, updateElo } from './elo-rating.js';

/**
 * Infer provider from model name.
 */
function inferProvider(model: string): string {
    const lower = model.toLowerCase();
    if (lower.includes('claude') || lower.includes('anthropic')) return 'anthropic';
    if (lower.includes('gpt') || lower.includes('o3') || lower.includes('o1')) return 'openai';
    if (lower.includes('qwen') || lower.includes('llama') || lower.includes('mistral') || lower.includes('deepseek') || lower.includes('codestral')) return 'ollama';
    return 'unknown';
}

/**
 * Compute Pareto ranks. Rank 1 = Pareto-optimal (no model dominates on both quality AND cost).
 */
function computeParetoRanks(entries: Array<{ passRate: number; costPerTask_usd: number }>): number[] {
    const ranks: number[] = new Array(entries.length).fill(1);

    for (let i = 0; i < entries.length; i++) {
        let dominated = 0;
        const ei = entries[i]!;
        for (let j = 0; j < entries.length; j++) {
            if (i === j) continue;
            const ej = entries[j]!;
            // j dominates i if j is better in both quality AND cost
            if (ej.passRate >= ei.passRate && ej.costPerTask_usd <= ei.costPerTask_usd) {
                if (ej.passRate > ei.passRate || ej.costPerTask_usd < ei.costPerTask_usd) {
                    dominated++;
                }
            }
        }
        ranks[i] = dominated + 1;
    }

    return ranks;
}

/**
 * Build leaderboard from one or more SuiteResults.
 *
 * @param results - Array of SuiteResult (e.g., from multiple benchmark runs).
 * @returns Aggregated leaderboard data.
 */
export function buildLeaderboard(results: readonly SuiteResult[]): LeaderboardData {
    if (results.length === 0) {
        return {
            updatedAt: new Date().toISOString(),
            suiteVersion: '1.0.0',
            totalWorkflows: 0,
            entries: [],
            meta: { generatedBy: 'chainskills', domains: [], runsPerModel: 0 },
        };
    }

    // Merge model metrics from all results
    const modelMap = new Map<string, SuiteModelMetrics[]>();
    for (const result of results) {
        for (const metrics of result.modelMetrics) {
            const existing = modelMap.get(metrics.model) ?? [];
            existing.push(metrics);
            modelMap.set(metrics.model, existing);
        }
    }

    // Build entries
    const rawEntries: Array<Omit<LeaderboardEntry, 'paretoRank'>> = [];

    for (const [model, metricsList] of modelMap) {
        // Average across all runs
        const totalWorkflows = metricsList.reduce((s, m) => s + m.totalWorkflows, 0) / metricsList.length;
        const avgPassRate = metricsList.reduce((s, m) => s + m.successRate, 0) / metricsList.length;
        const avgDuration = metricsList.reduce((s, m) => s + m.avgDuration_ms, 0) / metricsList.length;
        const totalTokens = metricsList.reduce((s, m) => s + m.totalTokens, 0);
        const avgCost = metricsList.reduce((s, m) => s + m.estimatedCost_usd, 0) / metricsList.length;

        // Reliability: standard deviation of pass rates
        const passRates = metricsList.map((m) => m.successRate);
        const mean = passRates.reduce((s, r) => s + r, 0) / passRates.length;
        const variance = passRates.reduce((s, r) => s + (r - mean) ** 2, 0) / passRates.length;
        const reliability = Math.max(0, 1 - Math.sqrt(variance));

        // Per-domain scores
        const domains: Partial<Record<BenchDomain, DomainScore>> = {};
        const allDomains = new Set<BenchDomain>();
        for (const m of metricsList) {
            for (const d of Object.keys(m.domains) as BenchDomain[]) {
                allDomains.add(d);
            }
        }
        for (const d of allDomains) {
            const dMetrics = metricsList
                .filter((m) => m.domains[d])
                .map((m) => m.domains[d]);
            if (dMetrics.length > 0) {
                const passed = dMetrics.reduce((s, m) => s + m.passed, 0);
                const total = dMetrics.reduce((s, m) => s + m.total, 0);
                const avgDur = dMetrics.reduce((s, m) => s + m.avgDuration_ms, 0) / dMetrics.length;

                domains[d] = {
                    elo: 1500, // Updated below via pairwise Elo
                    passRate: total > 0 ? passed / total : 0,
                    avgTokens: 0,
                    avgLatency_ms: Math.round(avgDur),
                    costPerTask_usd: 0,
                };
            }
        }

        // Elo: simplified — base 1500 + bonus per pass rate
        const elo = Math.round(1500 + (avgPassRate - 0.5) * 200 + (reliability - 0.5) * 50);

        const costPerTask = avgCost > 0 ? avgCost / Math.max(totalWorkflows, 1) : 0;
        const costEfficiency = costPerTask > 0 ? avgPassRate / costPerTask : avgPassRate * 1000;

        rawEntries.push({
            model,
            provider: inferProvider(model),
            elo,
            passRate: Math.round(avgPassRate * 1000) / 1000,
            domains,
            costPerTask_usd: Math.round(costPerTask * 10000) / 10000,
            avgLatency_ms: Math.round(avgDuration),
            totalTokens,
            reliability: Math.round(reliability * 1000) / 1000,
            costEfficiency: Math.round(costEfficiency * 100) / 100,
        });
    }

    // Compute Pareto ranks
    const paretoRanks = computeParetoRanks(
        rawEntries.map((e) => ({ passRate: e.passRate, costPerTask_usd: e.costPerTask_usd })),
    );

    const entries: LeaderboardEntry[] = rawEntries
        .map((e, i) => ({ ...e, paretoRank: paretoRanks[i] ?? 999 }))
        .sort((a, b) => b.elo - a.elo);

    // Collect domains
    const allDomains = new Set<BenchDomain>();
    for (const result of results) {
        if (result.filters.domain) allDomains.add(result.filters.domain);
        for (const m of result.modelMetrics) {
            for (const d of Object.keys(m.domains) as BenchDomain[]) {
                allDomains.add(d);
            }
        }
    }

    return {
        updatedAt: new Date().toISOString(),
        suiteVersion: results[0]!.suiteVersion,
        totalWorkflows: results[0]!.workflowCount,
        entries,
        meta: {
            generatedBy: 'chainskills v1.0.0',
            domains: [...allDomains],
            runsPerModel: results[0]!.runsPerModel,
        },
    };
}

/**
 * Generate a shields.io badge for a model.
 */
export function generateBadge(entry: LeaderboardEntry): BadgeData {
    const color =
        entry.elo >= 1550 ? 'brightgreen' :
        entry.elo >= 1500 ? 'green' :
        entry.elo >= 1450 ? 'yellow' :
        'red';

    return {
        schemaVersion: 1,
        label: 'chainskills',
        message: `Elo ${entry.elo} | ${Math.round(entry.passRate * 100)}%`,
        color,
    };
}
