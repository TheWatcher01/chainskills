/**
 * OpenAI-compatible agent adapter.
 *
 * Implements the `AgentProvider` port using the OpenAI Chat Completions API.
 * Compatible with any OpenAI-API-compatible endpoint (OpenAI, Azure, Ollama,
 * LM Studio, Groq, Together, etc.) via configurable base URL.
 *
 * No external SDK dependency — uses native `fetch` for HTTP calls.
 *
 * @module adapters/agents/openai-agent
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

/** Configuration for the OpenAI-compatible agent adapter. */
export interface OpenAIAgentConfig {
    /** API key for authentication. */
    readonly apiKey: string;
    /** Base URL for the API. Defaults to OpenAI. */
    readonly baseUrl: string;
    /** Default model to use. */
    readonly model: string;
    /** Default max tokens. */
    readonly maxTokens: number;
    /** Default temperature. */
    readonly temperature: number;
    /** Request timeout in ms. */
    readonly timeout: number;
    /** Named agent configurations (maps agent name → system prompt). */
    readonly agents: Readonly<Record<string, string>>;
}

/** Default configuration values. */
const DEFAULT_OPENAI_CONFIG: OpenAIAgentConfig = {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    maxTokens: 4096,
    temperature: 0.7,
    timeout: 60_000,
    agents: {
        copilot: 'You are a helpful coding assistant. Follow the user instructions precisely.',
        reviewer: 'You are a code reviewer. Analyze the code for bugs, security issues, and improvements.',
        writer: 'You are a technical writer. Generate clear, well-structured documentation.',
    },
};

// ─── OpenAI API Types ────────────────────────────────────────────────────────

interface ChatCompletionRequest {
    model: string;
    messages: Array<{ role: string; content: string }>;
    max_tokens?: number;
    temperature?: number;
}

interface ChatCompletionResponse {
    id: string;
    choices: Array<{
        message: { role: string; content: string };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    model: string;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create an OpenAI-compatible agent provider.
 *
 * @param config - Partial config (merged with defaults).
 * @param logger - Optional logger for debug output.
 * @returns An `AgentProvider` instance.
 */
export function createOpenAIAgent(
    config?: Partial<OpenAIAgentConfig>,
    logger?: Logger,
): AgentProvider {
    const cfg: OpenAIAgentConfig = {
        ...DEFAULT_OPENAI_CONFIG,
        ...config,
        agents: {
            ...DEFAULT_OPENAI_CONFIG.agents,
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
                    message:
                        'No API key configured. Set AGENT_API_KEY environment variable.',
                    agent,
                });
            }

            // Build system prompt
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

            // Build messages
            const apiMessages: Array<{ role: string; content: string }> = [
                { role: 'system', content: system },
            ];

            // Add extra conversation history
            if (extraMessages) {
                for (const msg of extraMessages) {
                    apiMessages.push({
                        role: msg.role,
                        content: msg.content,
                    });
                }
            }

            // Add the main prompt
            apiMessages.push({ role: 'user', content: prompt });

            const effectiveModel = options.model ?? cfg.model;
            const body: ChatCompletionRequest = {
                model: effectiveModel,
                messages: apiMessages,
                max_tokens: maxTokens ?? cfg.maxTokens,
                temperature: temperature ?? cfg.temperature,
            };

            logger?.debug(`@agent ${agent}: calling ${cfg.baseUrl}`, {
                model: effectiveModel,
                promptLength: prompt.length,
            });

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(),
                    cfg.timeout,
                );

                const response = await fetch(
                    `${cfg.baseUrl}/chat/completions`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${cfg.apiKey}`,
                        },
                        body: JSON.stringify(body),
                        signal: controller.signal,
                    },
                );

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorBody = await response.text();
                    return err({
                        code: 'AGENT_API_ERROR',
                        message: `Agent API error (${response.status}): ${errorBody.slice(0, 200)}`,
                        agent,
                    });
                }

                const data =
                    (await response.json()) as ChatCompletionResponse;

                const choice = data.choices?.[0];
                if (!choice) {
                    return err({
                        code: 'AGENT_EMPTY_RESPONSE',
                        message: 'Agent returned no response choices',
                        agent,
                    });
                }

                logger?.info(`@agent ${agent}: response received`, {
                    model: data.model,
                    tokens: data.usage?.total_tokens,
                });

                return ok({
                    content: choice.message.content,
                    usage: data.usage
                        ? {
                            promptTokens: data.usage.prompt_tokens,
                            completionTokens:
                                data.usage.completion_tokens,
                            totalTokens: data.usage.total_tokens,
                        }
                        : undefined,
                    model: data.model,
                });
            } catch (e) {
                if (
                    e instanceof Error &&
                    e.name === 'AbortError'
                ) {
                    return err({
                        code: 'AGENT_TIMEOUT',
                        message: `Agent request timed out after ${cfg.timeout}ms`,
                        agent,
                    });
                }

                return err({
                    code: 'AGENT_NETWORK_ERROR',
                    message: `Agent network error: ${e instanceof Error ? e.message : String(e)}`,
                    agent,
                });
            }
        },

        has(_agent: string): boolean {
            // Any agent name is valid — we generate a default system prompt
            return true;
        },

        list(): string[] {
            return Object.keys(cfg.agents);
        },
    };
}

/**
 * Create a noop agent provider that always returns a stub response.
 * Used in tests and dry-run mode.
 */
export function createNoopAgent(): AgentProvider {
    return {
        async invoke(
            options: AgentInvokeOptions,
        ): Promise<Result<AgentResult, AgentError>> {
            return ok({
                content: `[dry-run] @agent ${options.agent}: "${options.prompt.slice(0, 100)}"`,
                model: 'noop',
            });
        },
        has(): boolean {
            return true;
        },
        list(): string[] {
            return ['copilot', 'reviewer', 'writer'];
        },
    };
}
