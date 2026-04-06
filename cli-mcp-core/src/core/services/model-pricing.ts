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

/** Known model pricing table (April 2026). */
const PRICING_TABLE: Record<string, ModelPricing> = {
    // Anthropic
    'claude-opus-4-6': { input_per_mtok: 15, output_per_mtok: 75 },
    'claude-sonnet-4-6': { input_per_mtok: 3, output_per_mtok: 15 },
    'claude-haiku-4-5-20251001': { input_per_mtok: 0.8, output_per_mtok: 4 },
    'claude-sonnet-4-20250514': { input_per_mtok: 3, output_per_mtok: 15 },
    // Aliases
    'claude-opus': { input_per_mtok: 15, output_per_mtok: 75 },
    'claude-sonnet': { input_per_mtok: 3, output_per_mtok: 15 },
    'claude-haiku': { input_per_mtok: 0.8, output_per_mtok: 4 },

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
