/**
 * Agent provider port — delegates natural-language tasks to AI agents.
 *
 * Used by `@agent` and `@handoff` directives to interact with LLMs.
 * The port is agnostic of the underlying LLM provider (OpenAI, Anthropic,
 * Ollama, etc.) — concrete implementations live in adapters.
 *
 * @module core/ports/agent-provider
 */

import type { Result } from '#infra/errors.js';
import type { ChainskillsError } from '#infra/errors.js';

/** Error from agent invocation. */
export interface AgentError extends ChainskillsError {
    /** The agent name that was invoked. */
    readonly agent?: string;
}

/** Message in the agent conversation. */
export interface AgentMessage {
    readonly role: 'system' | 'user' | 'assistant';
    readonly content: string;
}

/** Options for an agent invocation. */
export interface AgentInvokeOptions {
    /** The agent name/identifier. */
    readonly agent: string;
    /** The prompt or task description. */
    readonly prompt: string;
    /** Optional system instructions. */
    readonly systemPrompt?: string;
    /** Optional conversation history for multi-turn. */
    readonly messages?: readonly AgentMessage[];
    /** Maximum tokens to generate. */
    readonly maxTokens?: number;
    /** Temperature for generation (0-2). */
    readonly temperature?: number;
    /** Override model for this invocation (e.g., for replay/bench). */
    readonly model?: string;
    /** Workflow variables available for context. */
    readonly variables?: Record<string, unknown>;
}

/** Result of an agent invocation. */
export interface AgentResult {
    /** The agent's generated text response. */
    readonly content: string;
    /** Token usage if available. */
    readonly usage?: {
        readonly promptTokens: number;
        readonly completionTokens: number;
        readonly totalTokens: number;
    };
    /** The model used. */
    readonly model?: string;
}

/**
 * Abstract interface for AI agent integration.
 *
 * Implementations connect to LLM APIs (OpenAI, Anthropic, Ollama, etc.)
 * and provide a unified interface for the `@agent` and `@handoff` directives.
 */
export interface AgentProvider {
    /**
     * Invoke an agent with a prompt and return the response.
     *
     * @param options - Agent invocation parameters.
     * @returns The agent's response or an error.
     */
    invoke(options: AgentInvokeOptions): Promise<Result<AgentResult, AgentError>>;

    /**
     * Check whether a named agent is available.
     *
     * @param agent - The agent name/identifier.
     * @returns True if the agent can be invoked.
     */
    has(agent: string): boolean;

    /**
     * List available agent names.
     *
     * @returns Array of available agent identifiers.
     */
    list(): string[];
}
