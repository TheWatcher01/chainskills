/**
 * Tests for the agent provider port and adapters.
 *
 * - Noop agent (dry-run / test mode)
 * - OpenAI agent config merging
 * - Directive handler integration with agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createNoopAgent,
    createOpenAIAgent,
} from '#adapters/agents/openai-agent.js';
import type {
    AgentProvider,
    AgentInvokeOptions,
} from '#core/ports/agent-provider.port.js';
import { isOk, isErr } from '#infra/errors.js';

// ─── Noop Agent ──────────────────────────────────────────────────────────────

describe('createNoopAgent', () => {
    let agent: AgentProvider;

    beforeEach(() => {
        agent = createNoopAgent();
    });

    it('should return a stub response', async () => {
        const result = await agent.invoke({
            agent: 'copilot',
            prompt: 'Write a hello world function',
        });

        expect(isOk(result)).toBe(true);
        if (result.ok) {
            expect(result.value.content).toContain('[dry-run]');
            expect(result.value.content).toContain('@agent copilot');
            expect(result.value.model).toBe('noop');
        }
    });

    it('should truncate long prompts in stub response', async () => {
        const longPrompt = 'x'.repeat(200);
        const result = await agent.invoke({
            agent: 'writer',
            prompt: longPrompt,
        });

        expect(isOk(result)).toBe(true);
        if (result.ok) {
            // Prompt is sliced to 100 chars in noop
            expect(result.value.content.length).toBeLessThan(200);
        }
    });

    it('should report all agents as available', () => {
        expect(agent.has('copilot')).toBe(true);
        expect(agent.has('unknown-agent')).toBe(true);
    });

    it('should list default agent names', () => {
        const names = agent.list();
        expect(names).toContain('copilot');
        expect(names).toContain('reviewer');
        expect(names).toContain('writer');
    });
});

// ─── OpenAI Agent ────────────────────────────────────────────────────────────

describe('createOpenAIAgent', () => {
    it('should merge config with defaults', () => {
        const agent = createOpenAIAgent({
            apiKey: 'test-key',
            model: 'gpt-4',
        });

        // Should have the custom agents plus defaults
        const names = agent.list();
        expect(names).toContain('copilot');
        expect(names).toContain('reviewer');
        expect(names).toContain('writer');
    });

    it('should include custom named agents', () => {
        const agent = createOpenAIAgent({
            apiKey: 'test-key',
            agents: { custom: 'You are a custom agent.' },
        });

        const names = agent.list();
        expect(names).toContain('custom');
        // Defaults should still be present
        expect(names).toContain('copilot');
    });

    it('should return error when no API key is configured', async () => {
        const agent = createOpenAIAgent({ apiKey: '' });
        const result = await agent.invoke({
            agent: 'copilot',
            prompt: 'test',
        });

        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.code).toBe('AGENT_NO_API_KEY');
        }
    });

    it('should accept any agent name via has()', () => {
        const agent = createOpenAIAgent({ apiKey: 'test-key' });
        expect(agent.has('anything')).toBe(true);
    });
});

// ─── OpenAI Agent - Network Errors ───────────────────────────────────────────

describe('createOpenAIAgent network', () => {
    it('should return AGENT_API_ERROR on non-ok response', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            text: async () => 'Unauthorized',
        }) as unknown as typeof fetch;

        try {
            const agent = createOpenAIAgent({
                apiKey: 'bad-key',
                baseUrl: 'https://fake.api',
            });

            const result = await agent.invoke({
                agent: 'copilot',
                prompt: 'test',
            });

            expect(isErr(result)).toBe(true);
            if (!result.ok) {
                expect(result.error.code).toBe('AGENT_API_ERROR');
                expect(result.error.message).toContain('401');
            }
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('should return AGENT_NETWORK_ERROR on fetch failure', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockRejectedValue(
            new Error('ECONNREFUSED'),
        ) as unknown as typeof fetch;

        try {
            const agent = createOpenAIAgent({
                apiKey: 'test-key',
                baseUrl: 'https://fake.api',
            });

            const result = await agent.invoke({
                agent: 'copilot',
                prompt: 'test',
            });

            expect(isErr(result)).toBe(true);
            if (!result.ok) {
                expect(result.error.code).toBe('AGENT_NETWORK_ERROR');
            }
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('should return AGENT_EMPTY_RESPONSE when no choices', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async (): Promise<unknown> => ({
                id: 'test',
                choices: [],
                model: 'gpt-4o-mini',
            }),
        }) as unknown as typeof fetch;

        try {
            const agent = createOpenAIAgent({
                apiKey: 'test-key',
                baseUrl: 'https://fake.api',
            });

            const result = await agent.invoke({
                agent: 'copilot',
                prompt: 'test',
            });

            expect(isErr(result)).toBe(true);
            if (!result.ok) {
                expect(result.error.code).toBe('AGENT_EMPTY_RESPONSE');
            }
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('should return successful agent result', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async (): Promise<unknown> => ({
                id: 'chatcmpl-test',
                choices: [
                    {
                        message: { role: 'assistant', content: 'Hello world!' },
                        finish_reason: 'stop',
                    },
                ],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 5,
                    total_tokens: 15,
                },
                model: 'gpt-4o-mini',
            }),
        }) as unknown as typeof fetch;

        try {
            const agent = createOpenAIAgent({
                apiKey: 'test-key',
                baseUrl: 'https://fake.api',
            });

            const result = await agent.invoke({
                agent: 'copilot',
                prompt: 'Say hello',
            });

            expect(isOk(result)).toBe(true);
            if (result.ok) {
                expect(result.value.content).toBe('Hello world!');
                expect(result.value.model).toBe('gpt-4o-mini');
                expect(result.value.usage).toEqual({
                    promptTokens: 10,
                    completionTokens: 5,
                    totalTokens: 15,
                });
            }
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('should inject variables into system prompt', async () => {
        const originalFetch = globalThis.fetch;
        let capturedBody: string | undefined;

        globalThis.fetch = vi.fn().mockImplementation(
            (_url: unknown, init: { body?: string }) => {
                capturedBody = init?.body;
                return Promise.resolve({
                    ok: true,
                    json: async (): Promise<unknown> => ({
                        id: 'test',
                        choices: [
                            {
                                message: { role: 'assistant', content: 'ok' },
                                finish_reason: 'stop',
                            },
                        ],
                        model: 'gpt-4o-mini',
                    }),
                });
            },
        ) as unknown as typeof fetch;

        try {
            const agent = createOpenAIAgent({
                apiKey: 'test-key',
                baseUrl: 'https://fake.api',
            });

            await agent.invoke({
                agent: 'copilot',
                prompt: 'Analyze this',
                variables: { target: 'example.com', depth: 3 },
            });

            expect(capturedBody).toBeDefined();
            const body = JSON.parse(capturedBody!) as {
                messages: Array<{ role: string; content: string }>;
            };
            const systemMsg = body.messages.find(
                (m: { role: string }) => m.role === 'system',
            );
            expect(systemMsg?.content).toContain('$target');
            expect(systemMsg?.content).toContain('example.com');
            expect(systemMsg?.content).toContain('$depth');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});

// ─── Container Integration ───────────────────────────────────────────────────

describe('agent in container', () => {
    it('should provide a noop agent when no API key is set', async () => {
        // Ensure no AGENT_API_KEY leaks from environment
        const savedKey = process.env['AGENT_API_KEY'];
        delete process.env['AGENT_API_KEY'];

        try {
            const { createContainer } = await import('#config/container.js');
            const container = await createContainer({
                executor: 'simple',
                logLevel: 'error',
            });

            expect(container.agent).toBeDefined();
            expect(container.agent.has('copilot')).toBe(true);

            const result = await container.agent.invoke({
                agent: 'copilot',
                prompt: 'test',
            });

            expect(isOk(result)).toBe(true);
            if (result.ok) {
                expect(result.value.content).toContain('[dry-run]');
            }
        } finally {
            // Restore env
            if (savedKey !== undefined) process.env['AGENT_API_KEY'] = savedKey;
        }
    });

    it('should export AgentProvider types from public API', async () => {
        const mod = await import('../../src/index.js');
        // Verify the factories are exported
        expect(typeof mod.createOpenAIAgent).toBe('function');
        expect(typeof mod.createNoopAgent).toBe('function');
    });
});
