/**
 * Tests for the Anthropic native agent adapter.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnthropicAgent } from '../../src/adapters/agents/anthropic-agent.js';

describe('createAnthropicAgent', () => {
    const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };

    it('returns error when no API key is set', async () => {
        const agent = createAnthropicAgent({ apiKey: '' }, mockLogger);
        const result = await agent.invoke({
            agent: 'copilot',
            prompt: 'Hello',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('AGENT_NO_API_KEY');
        }
    });

    it('has() returns true for any agent name', () => {
        const agent = createAnthropicAgent({});
        expect(agent.has('copilot')).toBe(true);
        expect(agent.has('custom-agent')).toBe(true);
    });

    it('list() returns default agent names', () => {
        const agent = createAnthropicAgent({});
        const names = agent.list();
        expect(names).toContain('copilot');
        expect(names).toContain('reviewer');
        expect(names).toContain('writer');
    });

    it('merges custom agents with defaults', () => {
        const agent = createAnthropicAgent({
            agents: { analyst: 'You analyze data' },
        });
        const names = agent.list();
        expect(names).toContain('copilot');
        expect(names).toContain('analyst');
    });

    it('calls Anthropic API with correct format', async () => {
        const mockResponse = {
            ok: true,
            json: async () => ({
                id: 'msg_123',
                type: 'message',
                role: 'assistant',
                content: [{ type: 'text', text: 'Hello from Claude' }],
                model: 'claude-sonnet-4-6',
                stop_reason: 'end_turn',
                usage: { input_tokens: 10, output_tokens: 5 },
            }),
        };

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue(mockResponse) as unknown as typeof fetch;

        try {
            const agent = createAnthropicAgent({
                apiKey: 'test-key',
                model: 'claude-sonnet-4-6',
            }, mockLogger);

            const result = await agent.invoke({
                agent: 'copilot',
                prompt: 'Write a function',
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.content).toBe('Hello from Claude');
                expect(result.value.model).toBe('claude-sonnet-4-6');
                expect(result.value.usage?.promptTokens).toBe(10);
                expect(result.value.usage?.completionTokens).toBe(5);
                expect(result.value.usage?.totalTokens).toBe(15);
            }

            // Verify fetch was called with correct headers
            const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(fetchCall[0]).toBe('https://api.anthropic.com/v1/messages');
            const options = fetchCall[1] as RequestInit;
            const headers = options.headers as Record<string, string>;
            expect(headers['x-api-key']).toBe('test-key');
            expect(headers['anthropic-version']).toBe('2023-06-01');

            // Verify body format (system as separate param, not in messages)
            const body = JSON.parse(options.body as string);
            expect(body.system).toBeDefined();
            expect(body.messages).toHaveLength(1);
            expect(body.messages[0].role).toBe('user');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('handles API error responses', async () => {
        const mockResponse = {
            ok: false,
            status: 400,
            text: async () => JSON.stringify({
                type: 'error',
                error: { type: 'invalid_request_error', message: 'Invalid model' },
            }),
        };

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue(mockResponse) as unknown as typeof fetch;

        try {
            const agent = createAnthropicAgent({ apiKey: 'test-key' }, mockLogger);
            const result = await agent.invoke({ agent: 'copilot', prompt: 'test' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('AGENT_API_ERROR');
                expect(result.error.message).toContain('invalid_request_error');
            }
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('respects per-invocation model override', async () => {
        const mockResponse = {
            ok: true,
            json: async () => ({
                id: 'msg_456',
                type: 'message',
                role: 'assistant',
                content: [{ type: 'text', text: 'Response' }],
                model: 'claude-haiku-4-5-20251001',
                stop_reason: 'end_turn',
                usage: { input_tokens: 5, output_tokens: 3 },
            }),
        };

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue(mockResponse) as unknown as typeof fetch;

        try {
            const agent = createAnthropicAgent({
                apiKey: 'test-key',
                model: 'claude-sonnet-4-6',
            }, mockLogger);

            await agent.invoke({
                agent: 'copilot',
                prompt: 'test',
                model: 'claude-haiku-4-5-20251001',
            });

            const body = JSON.parse(
                ((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body as string,
            );
            expect(body.model).toBe('claude-haiku-4-5-20251001');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('handles network errors', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

        try {
            const agent = createAnthropicAgent({ apiKey: 'test-key' }, mockLogger);
            const result = await agent.invoke({ agent: 'copilot', prompt: 'test' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('AGENT_NETWORK_ERROR');
                expect(result.error.message).toContain('ECONNREFUSED');
            }
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
