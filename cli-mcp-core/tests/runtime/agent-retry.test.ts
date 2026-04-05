/**
 * Tests for @agent/@handoff retry + exponential backoff.
 */

import { describe, it, expect, vi } from 'vitest';
import { handleAgentOrHandoff } from '#adapters/executor/directive-handlers.js';
import { createMemoryStore } from '#adapters/state/memory-store.js';
import type { Directive } from '#core/entities/directive.js';
import type { DirectiveHandlerContext } from '#adapters/executor/directive-handlers.js';
import type { AgentProvider } from '#core/ports/agent-provider.port.js';

function makeDirective(overrides: Partial<Directive['args']> = {}): Directive {
    return {
        type: 'agent',
        raw: '@agent copilot: "test prompt"',
        args: {
            agent: 'copilot',
            message: 'test prompt',
            capture: 'result',
            ...overrides,
        },
    };
}

function makeCtx(agent?: AgentProvider): DirectiveHandlerContext {
    return {
        store: createMemoryStore(),
        tools: { call: vi.fn(), has: vi.fn() },
        dryRun: false,
        stepId: 'test-step',
        agent,
    };
}

function createMockAgent(results: Array<{ ok: true; value: { content: string; model: string; usage?: { totalTokens: number } } } | { ok: false; error: { message: string; code: string } }>): AgentProvider {
    let callIndex = 0;
    return {
        invoke: vi.fn(async () => {
            const result = results[callIndex] ?? results[results.length - 1]!;
            callIndex++;
            return result;
        }),
        has: () => true,
        list: () => ['copilot'],
    };
}

describe('@agent retry + backoff', () => {
    it('should succeed on first attempt with no retries configured', async () => {
        const agent = createMockAgent([
            { ok: true, value: { content: 'response', model: 'test' } },
        ]);
        const ctx = makeCtx(agent);
        const directive = makeDirective();

        const result = await handleAgentOrHandoff(directive, ctx);

        expect(result.continue).toBe(true);
        expect(result.output).toBe('response');
        expect(agent.invoke).toHaveBeenCalledTimes(1);
    });

    it('should fail immediately with no retries when agent errors', async () => {
        const agent = createMockAgent([
            { ok: false, error: { message: 'rate limited', code: 'RATE_LIMIT' } },
        ]);
        const ctx = makeCtx(agent);
        const directive = makeDirective();

        const result = await handleAgentOrHandoff(directive, ctx);

        expect(result.continue).toBe(false);
        expect(result.error).toContain('rate limited');
        expect(agent.invoke).toHaveBeenCalledTimes(1);
    });

    it('should retry and succeed on second attempt', async () => {
        const agent = createMockAgent([
            { ok: false, error: { message: 'timeout', code: 'TIMEOUT' } },
            { ok: true, value: { content: 'retry success', model: 'test' } },
        ]);
        const ctx = makeCtx(agent);
        const directive = makeDirective({ max_retries: 2, backoff_ms: 10 });

        const result = await handleAgentOrHandoff(directive, ctx);

        expect(result.continue).toBe(true);
        expect(result.output).toBe('retry success');
        expect(agent.invoke).toHaveBeenCalledTimes(2);
    });

    it('should exhaust all retries and fail', async () => {
        const agent = createMockAgent([
            { ok: false, error: { message: 'error 1', code: 'ERR' } },
            { ok: false, error: { message: 'error 2', code: 'ERR' } },
            { ok: false, error: { message: 'error 3', code: 'ERR' } },
        ]);
        const ctx = makeCtx(agent);
        const directive = makeDirective({ max_retries: 2, backoff_ms: 10 });

        const result = await handleAgentOrHandoff(directive, ctx);

        expect(result.continue).toBe(false);
        expect(result.error).toContain('after 3 attempts');
        expect(agent.invoke).toHaveBeenCalledTimes(3);
    });

    it('should succeed on third attempt with max_retries:2', async () => {
        const agent = createMockAgent([
            { ok: false, error: { message: 'fail 1', code: 'ERR' } },
            { ok: false, error: { message: 'fail 2', code: 'ERR' } },
            { ok: true, value: { content: 'finally', model: 'test' } },
        ]);
        const ctx = makeCtx(agent);
        const directive = makeDirective({ max_retries: 2, backoff_ms: 10 });

        const result = await handleAgentOrHandoff(directive, ctx);

        expect(result.continue).toBe(true);
        expect(result.output).toBe('finally');
        expect(agent.invoke).toHaveBeenCalledTimes(3);
    });

    it('should store response in capture variable', async () => {
        const agent = createMockAgent([
            { ok: true, value: { content: 'captured value', model: 'test' } },
        ]);
        const ctx = makeCtx(agent);
        const directive = makeDirective({ capture: 'my_var' });

        await handleAgentOrHandoff(directive, ctx);

        expect(ctx.store.get('my_var')).toBe('captured value');
    });

    it('should skip in dry-run mode', async () => {
        const agent = createMockAgent([
            { ok: true, value: { content: 'should not call', model: 'test' } },
        ]);
        const ctx = { ...makeCtx(agent), dryRun: true };
        const directive = makeDirective({ max_retries: 3 });

        const result = await handleAgentOrHandoff(directive, ctx);

        expect(result.continue).toBe(true);
        expect(agent.invoke).not.toHaveBeenCalled();
    });
});
