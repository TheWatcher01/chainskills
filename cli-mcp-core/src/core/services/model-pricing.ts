/**
 * Model pricing registry — cost estimation for LLM providers.
 *
 * Static lookup table of input/output token prices per model.
 * Prices in USD per million tokens (April 2026).
 *
 * Pure functions, zero external dependencies.
 *
 * @module core/services/model-pricing
 */

/** Pricing per million tokens. */
export interface ModelPricing {
    /** USD per 1M input tokens. */
    readonly input_per_mtok: number;
    /** USD per 1M output tokens. */
    readonly output_per_mtok: number;
}

/** Known model pricing table (April 2026, aligned with Claude Code modelCost.ts). */
const PRICING_TABLE: Record<string, ModelPricing> = {
    // Anthropic — exact prices from Claude Code source
    'claude-opus-4-6': { input_per_mtok: 15, output_per_mtok: 75 },
    'claude-opus-4-5': { input_per_mtok: 5, output_per_mtok: 25 },
    'claude-opus-4-1': { input_per_mtok: 15, output_per_mtok: 75 },
    'claude-sonnet-4-6': { input_per_mtok: 3, output_per_mtok: 15 },
    'claude-sonnet-4-5': { input_per_mtok: 3, output_per_mtok: 15 },
    'claude-sonnet-4-20250514': { input_per_mtok: 3, output_per_mtok: 15 },
    'claude-3-7-sonnet': { input_per_mtok: 3, output_per_mtok: 15 },
    'claude-3-5-sonnet': { input_per_mtok: 3, output_per_mtok: 15 },
    'claude-haiku-4-5': { input_per_mtok: 1, output_per_mtok: 5 },
    'claude-haiku-4-5-20251001': { input_per_mtok: 1, output_per_mtok: 5 },
    'claude-3-5-haiku': { input_per_mtok: 0.8, output_per_mtok: 4 },
    // Aliases (Claude Code model aliases)
    'opus': { input_per_mtok: 15, output_per_mtok: 75 },
    'sonnet': { input_per_mtok: 3, output_per_mtok: 15 },
    'haiku': { input_per_mtok: 1, output_per_mtok: 5 },

    // OpenAI
    'gpt-4o': { input_per_mtok: 2.5, output_per_mtok: 10 },
    'gpt-4o-mini': { input_per_mtok: 0.15, output_per_mtok: 0.6 },
    'gpt-4-turbo': { input_per_mtok: 10, output_per_mtok: 30 },
    'o3-mini': { input_per_mtok: 1.1, output_per_mtok: 4.4 },

    // Open-source (Ollama / local) — free
    'qwen3:8b': { input_per_mtok: 0, output_per_mtok: 0 },
    'llama3.3:70b': { input_per_mtok: 0, output_per_mtok: 0 },
    'mistral:7b': { input_per_mtok: 0, output_per_mtok: 0 },
    'codestral': { input_per_mtok: 0, output_per_mtok: 0 },
    'deepseek-r1': { input_per_mtok: 0, output_per_mtok: 0 },

    // Fallback for unknown — noop
    'noop': { input_per_mtok: 0, output_per_mtok: 0 },
};

/**
 * Get pricing for a model. Tries exact match, then fuzzy prefix match.
 *
 * @param model - Model identifier.
 * @returns Pricing or null if unknown.
 */
export function getModelPricing(model: string): ModelPricing | null {
    // Exact match
    if (PRICING_TABLE[model]) return PRICING_TABLE[model];

    // Fuzzy prefix match (e.g., 'claude-sonnet-4-6-20260401' → 'claude-sonnet-4-6')
    const lower = model.toLowerCase();
    for (const [key, pricing] of Object.entries(PRICING_TABLE)) {
        if (lower.startsWith(key)) return pricing;
    }

    return null;
}

/**
 * Estimate cost for a single LLM call.
 *
 * @param model - Model identifier.
 * @param inputTokens - Number of input tokens.
 * @param outputTokens - Number of output tokens.
 * @returns Estimated cost in USD, or 0 if model unknown.
 */
export function estimateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
): number {
    const pricing = getModelPricing(model);
    if (!pricing) return 0;

    return (
        (inputTokens / 1_000_000) * pricing.input_per_mtok +
        (outputTokens / 1_000_000) * pricing.output_per_mtok
    );
}

/**
 * Get all known model names.
 */
export function listKnownModels(): string[] {
    return Object.keys(PRICING_TABLE);
}

// ─── Effort Multipliers ──────────────────────────────────────────────────────

/** Effort level cost multipliers (aligned with Claude Code effort parameter). */
const EFFORT_MULTIPLIER: Record<string, number> = {
    low: 0.4,     // ~60% less thinking tokens
    medium: 0.7,  // ~30% less thinking tokens
    high: 1.0,    // baseline
    max: 1.3,     // ~30% more thinking tokens
};

/**
 * Estimate cost with effort level adjustment.
 *
 * @param model - Model identifier.
 * @param inputTokens - Number of input tokens.
 * @param outputTokens - Number of output tokens.
 * @param effort - Effort level (low/medium/high/max).
 * @returns Estimated cost in USD.
 */
export function estimateCostWithEffort(
    model: string,
    inputTokens: number,
    outputTokens: number,
    effort: string = 'high',
): number {
    const base = estimateCost(model, inputTokens, outputTokens);
    const multiplier = EFFORT_MULTIPLIER[effort] ?? 1.0;
    return base * multiplier;
}

/**
 * Get the effort multiplier for a given level.
 */
export function getEffortMultiplier(effort: string): number {
    return EFFORT_MULTIPLIER[effort] ?? 1.0;
}
