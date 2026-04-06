/**
 * Model router — intelligent model selection based on accumulated metrics.
 *
 * Analyzes historical task results to recommend the cheapest model
 * that meets quality thresholds for each task type.
 *
 * Pure functions, zero external dependencies (except core entities).
 *
 * @module core/services/model-router
 */

import type {
    TaskModelMetrics,
    ModelScorecard,
    RouteRecommendation,
    RouterConfig,
    EffortLevel,
} from '../entities/model-router.js';
import { DEFAULT_ROUTER_CONFIG } from '../entities/model-router.js';

// ─── Scorecard Builder ───────────────────────────────────────────────────────

/**
 * Build a scorecard from accumulated trace data.
 *
 * @param entries - Array of { taskType, difficulty, model, pass, duration_ms, tokens, toolCalls }
 * @returns Aggregated scorecard with routing recommendations.
 */
export function buildScorecard(
    entries: readonly ScorecardEntry[],
    config?: Partial<RouterConfig>,
): ModelScorecard {
    const cfg = { ...DEFAULT_ROUTER_CONFIG, ...config };

    // Group by (taskType, model, effort)
    const groups = new Map<string, ScorecardEntry[]>();
    for (const e of entries) {
        const key = `${e.taskType}::${e.model}::${e.effort ?? 'high'}`;
        const group = groups.get(key) ?? [];
        group.push(e);
        groups.set(key, group);
    }

    // Compute per-group metrics
    const metrics: TaskModelMetrics[] = [];
    for (const [key, group] of groups) {
        const [taskType, model, effort] = key.split('::') as [string, string, string];
        const runs = group.length;
        const passCount = group.filter((e) => e.pass).length;
        const passRate = passCount / runs;

        const avgDuration = group.reduce((s, e) => s + e.duration_ms, 0) / runs;
        const avgTokens = group.reduce((s, e) => s + e.tokens, 0) / runs;
        const avgCost = group.reduce((s, e) => s + e.cost_usd, 0) / runs;
        const avgToolCalls = group.reduce((s, e) => s + e.toolCalls, 0) / runs;

        // Reliability = 1 - stddev of pass (binary 0/1 per run)
        const passes = group.map((e) => (e.pass ? 1 : 0) as number);
        const mean = passes.reduce((s: number, v: number) => s + v, 0) / passes.length;
        const variance = passes.reduce((s: number, v: number) => s + (v - mean) ** 2, 0) / passes.length;
        const reliability = Math.max(0, 1 - Math.sqrt(variance));

        metrics.push({
            taskType,
            difficulty: group[0]?.difficulty ?? 'medium',
            model,
            effort: (effort ?? 'high') as EffortLevel,
            runs,
            passCount,
            passRate: round3(passRate),
            avgDuration_ms: Math.round(avgDuration),
            avgTokens: Math.round(avgTokens),
            avgCost_usd: round6(avgCost),
            avgToolCalls: Math.round(avgToolCalls),
            reliability: round3(reliability),
        });
    }

    // Collect unique values
    const models = [...new Set(metrics.map((m) => m.model))];
    const taskTypes = [...new Set(metrics.map((m) => m.taskType))];

    // Generate recommendations
    const recommendations = taskTypes.map((tt) =>
        recommend(tt, metrics, cfg),
    );

    // Estimate savings
    const estimatedSavings = computeEstimatedSavings(recommendations, metrics, cfg);

    return {
        updatedAt: new Date().toISOString(),
        totalRuns: entries.length,
        models,
        taskTypes,
        metrics,
        recommendations,
        estimatedSavings,
    };
}

// ─── Recommend ───────────────────────────────────────────────────────────────

/**
 * Recommend a model for a task type based on scorecard metrics.
 */
export function recommend(
    taskType: string,
    metrics: readonly TaskModelMetrics[],
    config?: Partial<RouterConfig>,
): RouteRecommendation {
    const cfg = { ...DEFAULT_ROUTER_CONFIG, ...config };
    const taskMetrics = metrics.filter((m) => m.taskType === taskType);

    if (taskMetrics.length === 0) {
        const fallback = cfg.cascade[cfg.cascade.length - 1] ?? { model: 'opus', effort: 'high' as EffortLevel };
        const fb = typeof fallback === 'string' ? { model: fallback, effort: 'high' as EffortLevel } : fallback;
        return {
            taskType,
            model: fb.model,
            effort: fb.effort,
            confidence: 0,
            reason: 'No data available — defaulting to most capable model',
            fallbackChain: cfg.cascade.map((c) => typeof c === 'string' ? { model: c, effort: 'high' as EffortLevel } : c),
            savingsVsExpensive: 0,
        };
    }

    // Le plus cher = dernier de la cascade
    const expensiveEntry = cfg.cascade[cfg.cascade.length - 1]!;
    const expensive = typeof expensiveEntry === 'string'
        ? { model: expensiveEntry, effort: 'high' as EffortLevel }
        : expensiveEntry;
    const expensiveMetrics = taskMetrics.find((m) => m.model === expensive.model && m.effort === expensive.effort);
    const expensiveCost = expensiveMetrics?.avgCost_usd ?? 0;

    // Parcourir la cascade 2D du moins cher au plus cher
    for (const entry of cfg.cascade) {
        const { model, effort } = typeof entry === 'string'
            ? { model: entry, effort: 'high' as EffortLevel }
            : entry;
        const m = taskMetrics.find((tm) => tm.model === model && tm.effort === effort);
        if (!m) continue;
        if (m.runs < cfg.minRuns) continue;

        if (m.passRate >= cfg.minPassRate) {
            const confidence = Math.min(1, m.passRate * (1 - 1 / Math.sqrt(m.runs + 1)));
            const savings = expensiveCost > 0
                ? Math.round((1 - m.avgCost_usd / expensiveCost) * 100)
                : 0;

            const idx = cfg.cascade.indexOf(entry);
            const remaining = cfg.cascade.slice(idx).map((c) =>
                typeof c === 'string' ? { model: c, effort: 'high' as EffortLevel } : c,
            );

            return {
                taskType,
                model,
                effort,
                confidence: round3(confidence),
                reason: buildReason(m, `${expensive.model}/${expensive.effort}`, savings),
                fallbackChain: remaining,
                savingsVsExpensive: Math.max(0, savings),
            };
        }
    }

    return {
        taskType,
        model: expensive.model,
        effort: expensive.effort,
        confidence: 1,
        reason: `Only ${expensive.model}/${expensive.effort} meets ${Math.round(cfg.minPassRate * 100)}% pass rate threshold`,
        fallbackChain: [expensive],
        savingsVsExpensive: 0,
    };
}

// ─── Task Classifier ─────────────────────────────────────────────────────────

/** Known task type keywords for classification. */
const TASK_KEYWORDS: Record<string, readonly string[]> = {
    'create-function': ['create', 'function', 'write a function', 'implement', 'slugify', 'utility'],
    'fix-bug': ['fix', 'bug', 'correct', 'repair', 'wrong', 'broken'],
    'write-test': ['test', 'spec', 'vitest', 'jest', 'assertion', 'coverage'],
    'refactor': ['refactor', 'class', 'pattern', 'extract', 'restructure', 'clean'],
    'add-feature': ['add', 'feature', 'extend', 'enhance', 'support', 'mode'],
    'debug': ['debug', 'leak', 'race condition', 'cache', 'performance', 'slow'],
    'multi-file': ['architecture', 'hexagonal', 'multi-file', 'projection', 'cqrs', 'port'],
    'audit': ['audit', 'review', 'security', 'investigate', 'vulnerability', 'scan'],
};

/**
 * Classify a task description into a task type.
 * Returns the best-matching type or 'unknown'.
 */
export function classifyTask(description: string): string {
    const lower = description.toLowerCase();
    let bestMatch = 'unknown';
    let bestScore = 0;

    for (const [taskType, keywords] of Object.entries(TASK_KEYWORDS)) {
        const score = keywords.filter((kw) => lower.includes(kw)).length;
        if (score > bestScore) {
            bestScore = score;
            bestMatch = taskType;
        }
    }

    return bestMatch;
}

// ─── Input type ──────────────────────────────────────────────────────────────

/** Entry for scorecard building. */
export interface ScorecardEntry {
    readonly taskType: string;
    readonly difficulty: 'easy' | 'medium' | 'hard';
    readonly model: string;
    readonly effort?: string;
    readonly pass: boolean;
    readonly duration_ms: number;
    readonly tokens: number;
    readonly cost_usd: number;
    readonly toolCalls: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildReason(m: TaskModelMetrics, expensiveModel: string, savings: number): string {
    const parts: string[] = [];
    parts.push(`${Math.round(m.passRate * 100)}% pass rate on '${m.taskType}'`);
    if (savings > 0) parts.push(`${savings}% cheaper than ${expensiveModel}`);
    if (m.avgDuration_ms > 0) parts.push(`avg ${m.avgDuration_ms}ms`);
    parts.push(`${m.runs} runs`);
    return parts.join(', ');
}

function computeEstimatedSavings(
    recommendations: readonly RouteRecommendation[],
    _metrics: readonly TaskModelMetrics[],
    cfg: RouterConfig,
): number {
    const expensive = cfg.cascade[cfg.cascade.length - 1];
    const expModel = typeof expensive === 'string' ? expensive : expensive?.model ?? 'opus';
    const expEffort = typeof expensive === 'string' ? 'high' : expensive?.effort ?? 'high';
    const routable = recommendations.filter((r) => r.model !== expModel || r.effort !== expEffort);
    if (recommendations.length === 0) return 0;
    return Math.round((routable.length / recommendations.length) * 100);
}

function round3(n: number): number { return Math.round(n * 1000) / 1000; }
function round6(n: number): number { return Math.round(n * 1000000) / 1000000; }
