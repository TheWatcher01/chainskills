/**
 * Anthropic-native agent adapter.
 *
 * Implements the `AgentProvider` port using the Anthropic Messages API directly.
 * Uses native `fetch` — no SDK dependency.
 *
 * Format: Messages API v1 with `system` parameter (not in messages array).
 * Supports per-invocation model override via `options.model`.
 *
 * @module adapters/agents/anthropic-agent
 */

import type {
    AgentProvider,
    AgentInvokeOptions,
    AgentResult,
    AgentError,
} from '#core/ports/agent-provider.port.js';
import type { Result } from '#infra/errors.js';
import { ok, err } from '#infra/errors.js';
import type { Logger } from '#infra/logger.js';

// ─── Config ──────────────────────────────────────────────────────────────────

/** Configuration for the Anthropic agent adapter. */
export interface AnthropicAgentConfig {
    /** Anthropic API key. */
    readonly apiKey: string;
    /** Base URL for the API (default: https://api.anthropic.com). */
    readonly baseUrl: string;
    /** Default model (e.g., claude-sonnet-4-6). */
    readonly model: string;
    /** Default max tokens. */
    readonly maxTokens: number;
    /** Default temperature. */
    readonly temperature: number;
    /** Request timeout in ms. */
    readonly timeout: number;
    /** Anthropic API version header. */
    readonly apiVersion: string;
    /** Named agent configurations (maps agent name -> system prompt). */
    readonly agents: Readonly<Record<string, string>>;
}

/** Default configuration values. */
const DEFAULT_ANTHROPIC_CONFIG: AnthropicAgentConfig = {
    apiKey: '',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
    temperature: 0.7,
    timeout: 120_000,
    apiVersion: '2023-06-01',
    agents: {
        copilot: 'You are a helpful coding assistant. Follow the user instructions precisely.',
        reviewer: 'You are a code reviewer. Analyze the code for bugs, security issues, and improvements.',
        writer: 'You are a technical writer. Generate clear, well-structured documentation.',
    },
};

// ─── Anthropic API Types ────────────────────────────────────────────────────

interface AnthropicMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface AnthropicRequest {
    model: string;
    max_tokens: number;
    system?: string;
    messages: AnthropicMessage[];
    temperature?: number;
    thinking?: {
        type: 'enabled';
        budget_tokens: number;
    };
}

interface AnthropicResponse {
    id: string;
    type: 'message';
    role: 'assistant';
    content: Array<{ type: 'text'; text: string }>;
    model: string;
    stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}

interface AnthropicErrorResponse {
    type: 'error';
    error: {
        type: string;
        message: string;
    };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create an Anthropic-native agent provider.
 *
 * @param config - Partial config (merged with defaults).
 * @param logger - Optional logger for debug output.
 * @returns An `AgentProvider` instance.
 */
export function createAnthropicAgent(
    config?: Partial<AnthropicAgentConfig>,
    logger?: Logger,
): AgentProvider {
    const cfg: AnthropicAgentConfig = {
        ...DEFAULT_ANTHROPIC_CONFIG,
        ...config,
        agents: {
            ...DEFAULT_ANTHROPIC_CONFIG.agents,
            ...config?.agents,
        },
    };

    return {
        async invoke(
            options: AgentInvokeOptions,
        ): Promise<Result<AgentResult, AgentError>> {
            const {
                agent,
                prompt,
                systemPrompt,
                messages: extraMessages,
                maxTokens,
                temperature,
                variables,
            } = options;

            // Check API key
            if (!cfg.apiKey) {
                return err({
                    code: 'AGENT_NO_API_KEY',
                    message: 'No Anthropic API key configured. Set ANTHROPIC_API_KEY environment variable.',
                    agent,
                });
            }

            // Build system prompt (separate parameter in Anthropic API)
            let system =
                systemPrompt ??
                cfg.agents[agent] ??
                `You are an AI agent named "${agent}". Follow the user instructions precisely.`;

            // Inject variables context if available
            if (variables && Object.keys(variables).length > 0) {
                system +=
                    '\n\nAvailable workflow variables:\n' +
                    Object.entries(variables)
                        .map(([k, v]) => `- $${k} = ${JSON.stringify(v)}`)
                        .join('\n');
            }

            // Build messages array (Anthropic: no system role in messages)
            const apiMessages: AnthropicMessage[] = [];

            // Add extra conversation history (filter out system messages)
            if (extraMessages) {
                for (const msg of extraMessages) {
                    if (msg.role === 'system') {
                        // Prepend to system prompt
                        system = msg.content + '\n\n' + system;
                    } else {
                        apiMessages.push({
                            role: msg.role as 'user' | 'assistant',
                            content: msg.content,
                        });
                    }
                }
            }

            // Add the main prompt
            apiMessages.push({ role: 'user', content: prompt });

            const effectiveModel = options.model ?? cfg.model;
            const body: AnthropicRequest = {
                model: effectiveModel,
                max_tokens: maxTokens ?? cfg.maxTokens,
                system,
                messages: apiMessages,
                temperature: temperature ?? cfg.temperature,
            };

            // Effort → thinking budget (aligned with Claude Code's effort parameter)
            if (options.effort) {
                const EFFORT_BUDGET: Record<string, number> = {
                    low: 1024,
                    medium: 4096,
                    high: 10000,
                    max: 32000,
                };
                const budgetTokens = EFFORT_BUDGET[options.effort] ?? 10000;
                body.thinking = { type: 'enabled', budget_tokens: budgetTokens };
            }

            logger?.debug(`@agent ${agent}: calling Anthropic API`, {
                model: effectiveModel,
                promptLength: prompt.length,
            });

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(),
                    cfg.timeout,
                );

                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'x-api-key': cfg.apiKey,
                    'anthropic-version': cfg.apiVersion,
                };
                if (body.thinking) {
                    headers['anthropic-beta'] = 'interleaved-thinking-2025-05-14';
                }

                const response = await fetch(
                    `${cfg.baseUrl}/v1/messages`,
                    {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(body),
                        signal: controller.signal,
                    },
                );

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorBody = await response.text();
                    let errorMessage = `Anthropic API error (${response.status})`;

                    // Parse structured error if possible
                    try {
                        const parsed = JSON.parse(errorBody) as AnthropicErrorResponse;
                        if (parsed.error?.message) {
                            errorMessage = `${errorMessage}: ${parsed.error.type} — ${parsed.error.message}`;
                        }
                    } catch {
                        errorMessage = `${errorMessage}: ${errorBody.slice(0, 200)}`;
                    }

                    return err({
                        code: 'AGENT_API_ERROR',
                        message: errorMessage,
                        agent,
                    });
                }

                const data = (await response.json()) as AnthropicResponse;

                // Extract text content from response blocks
                const textContent = data.content
                    .filter((block) => block.type === 'text')
                    .map((block) => block.text)
                    .join('\n');

                if (!textContent) {
                    return err({
                        code: 'AGENT_EMPTY_RESPONSE',
                        message: 'Anthropic returned no text content',
                        agent,
                    });
                }

                logger?.info(`@agent ${agent}: response received`, {
                    model: data.model,
                    inputTokens: data.usage.input_tokens,
                    outputTokens: data.usage.output_tokens,
                });

                return ok({
                    content: textContent,
                    usage: {
                        promptTokens: data.usage.input_tokens,
                        completionTokens: data.usage.output_tokens,
                        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
                    },
                    model: data.model,
                });
            } catch (e) {
                if (e instanceof Error && e.name === 'AbortError') {
                    return err({
                        code: 'AGENT_TIMEOUT',
                        message: `Anthropic request timed out after ${cfg.timeout}ms`,
                        agent,
                    });
                }

                return err({
                    code: 'AGENT_NETWORK_ERROR',
                    message: `Anthropic network error: ${e instanceof Error ? e.message : String(e)}`,
                    agent,
                });
            }
        },

        has(_agent: string): boolean {
            return true;
        },

        list(): string[] {
            return Object.keys(cfg.agents);
        },
    };
}
