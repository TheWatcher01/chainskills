/**
 * Tests for @schema directive handler — runtime validation of LLM outputs.
 */

import { describe, it, expect, vi } from 'vitest';
import { handleSchema } from '#adapters/executor/directive-handlers.js';
import { createMemoryStore } from '#adapters/state/memory-store.js';
import type { Directive } from '#core/entities/directive.js';
import type { DirectiveHandlerContext } from '#adapters/executor/directive-handlers.js';

function makeSchemaDirective(
    variable: string,
    schema: Record<string, unknown>,
): Directive {
    return {
        type: 'schema',
        raw: `@schema ${variable} ${JSON.stringify(schema)}`,
        args: { variable, schema },
    };
}

function makeCtx(
    storeData: Record<string, unknown> = {},
    agent?: DirectiveHandlerContext['agent'],
): DirectiveHandlerContext {
    const store = createMemoryStore(storeData);
    return {
        store,
        tools: { call: vi.fn(), has: vi.fn() },
        dryRun: false,
        stepId: 'test-step',
        agent,
    };
}

describe('@schema directive handler', () => {
    it('should pass when value matches schema', async () => {
        const ctx = makeCtx({ user: { name: 'Alice', age: 30 } });
        const directive = makeSchemaDirective('$user', {
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'number' },
            },
            required: ['name'],
        });

        const result = await handleSchema(directive, ctx);
        expect(result.continue).toBe(true);
    });

    it('should fail when value does not match schema and no agent', async () => {
        const ctx = makeCtx({ user: { age: 'not a number' } });
        const directive = makeSchemaDirective('$user', {
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'number' },
            },
            required: ['name'],
        });

        const result = await handleSchema(directive, ctx);
        expect(result.continue).toBe(false);
        expect(result.error).toContain('validation failed');
    });

    it('should parse JSON string values before validation', async () => {
        const ctx = makeCtx({ data: '{"name": "Bob", "score": 95}' });
        const directive = makeSchemaDirective('$data', {
            type: 'object',
            properties: {
                name: { type: 'string' },
                score: { type: 'number' },
            },
            required: ['name', 'score'],
        });

        const result = await handleSchema(directive, ctx);
        expect(result.continue).toBe(true);
        // Store should now have parsed object
        const stored = ctx.store.get('data') as Record<string, unknown>;
        expect(stored.name).toBe('Bob');
        expect(stored.score).toBe(95);
    });

    it('should validate simple string type', async () => {
        const ctx = makeCtx({ msg: 'hello world' });
        const directive = makeSchemaDirective('$msg', {
            type: 'string',
            minLength: 1,
        });

        const result = await handleSchema(directive, ctx);
        expect(result.continue).toBe(true);
    });

    it('should reject invalid type', async () => {
        const ctx = makeCtx({ count: 'not a number' });
        const directive = makeSchemaDirective('$count', {
            type: 'number',
        });

        const result = await handleSchema(directive, ctx);
        expect(result.continue).toBe(false);
    });

    it('should return error if variable ref is missing', async () => {
        const ctx = makeCtx({});
        const directive: Directive = {
            type: 'schema',
            raw: '@schema',
            args: {},
        };

        const result = await handleSchema(directive, ctx);
        expect(result.continue).toBe(false);
        expect(result.error).toContain('missing');
    });

    it('should return error if schema definition is missing', async () => {
        const ctx = makeCtx({ x: 1 });
        const directive: Directive = {
            type: 'schema',
            raw: '@schema $x',
            args: { variable: '$x' },
        };

        const result = await handleSchema(directive, ctx);
        expect(result.continue).toBe(false);
        expect(result.error).toContain('missing');
    });

    it('should retry with agent when validation fails', async () => {
        const agent = {
            invoke: vi.fn()
                .mockResolvedValueOnce({ ok: true, value: { content: '{"name":"Fixed"}', model: 'test' } }),
            has: () => true,
            list: () => ['copilot'],
        };

        const ctx = makeCtx({ user: 'invalid' }, agent);
        const directive = makeSchemaDirective('$user', {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
        });

        const result = await handleSchema(directive, ctx);
        expect(result.continue).toBe(true);
        expect(agent.invoke).toHaveBeenCalled();
    });
});
