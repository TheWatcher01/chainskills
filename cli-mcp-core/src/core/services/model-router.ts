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

    // Group by (taskType, model)
    const groups = new Map<string, ScorecardEntry[]>();
    for (const e of entries) {
        const key = `${e.taskType}::${e.model}`;
        const group = groups.get(key) ?? [];
        group.push(e);
        groups.set(key, group);
    }

    // Compute per-group metrics
    const metrics: TaskModelMetrics[] = [];
    for (const [key, group] of groups) {
        const [taskType, model] = key.split('::') as [string, string];
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
        // Pas assez de donnees — recommander le plus gros modele
        const fallback = cfg.cascade[cfg.cascade.length - 1] ?? 'opus';
        return {
            taskType,
            model: fallback,
            confidence: 0,
            reason: 'No data available — defaulting to most capable model',
            fallbackChain: [...cfg.cascade],
            savingsVsExpensive: 0,
        };
    }

    // Trier la cascade par cout croissant
    const expensiveModel = cfg.cascade[cfg.cascade.length - 1] ?? 'opus';
    const expensiveMetrics = taskMetrics.find((m) => m.model === expensiveModel);
    const expensiveCost = expensiveMetrics?.avgCost_usd ?? 0;

    // Parcourir la cascade du moins cher au plus cher
    for (const model of cfg.cascade) {
        const m = taskMetrics.find((tm) => tm.model === model);
        if (!m) continue;
        if (m.runs < cfg.minRuns) continue;

        if (m.passRate >= cfg.minPassRate) {
            // Calcul de confiance : augmente avec le nombre de runs
            const confidence = Math.min(1, m.passRate * (1 - 1 / Math.sqrt(m.runs + 1)));
            const savings = expensiveCost > 0
                ? Math.round((1 - m.avgCost_usd / expensiveCost) * 100)
                : 0;

            return {
                taskType,
                model,
                confidence: round3(confidence),
                reason: buildReason(m, expensiveModel, savings),
                fallbackChain: cfg.cascade.slice(cfg.cascade.indexOf(model)),
                savingsVsExpensive: Math.max(0, savings),
            };
        }
    }

    // Aucun modele cheap ne passe le seuil — recommander le plus cher
    return {
        taskType,
        model: expensiveModel,
        confidence: 1,
        reason: `Only ${expensiveModel} meets ${Math.round(cfg.minPassRate * 100)}% pass rate threshold`,
        fallbackChain: [expensiveModel],
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
    const expensiveModel = cfg.cascade[cfg.cascade.length - 1] ?? 'opus';
    const routable = recommendations.filter((r) => r.model !== expensiveModel);
    if (recommendations.length === 0) return 0;
    return Math.round((routable.length / recommendations.length) * 100);
}

function round3(n: number): number { return Math.round(n * 1000) / 1000; }
function round6(n: number): number { return Math.round(n * 1000000) / 1000000; }
