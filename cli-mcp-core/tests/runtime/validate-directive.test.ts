/**
 * Tests for the @validate directive handler.
 */

import { describe, it, expect } from 'vitest';
import { handleValidate } from '../../src/adapters/executor/directive-handlers.js';
import type { DirectiveHandlerContext } from '../../src/adapters/executor/directive-handlers.js';
import type { Directive } from '../../src/core/entities/directive.js';
import { createMemoryStore } from '../../src/adapters/state/memory-store.js';
import type { ToolProvider } from '../../src/core/ports/tool-provider.port.js';

const noopTools: ToolProvider = {
    async call() { return { ok: true, value: '' } as any; },
    has() { return false; },
};

function makeCtx(overrides: Partial<DirectiveHandlerContext> = {}): DirectiveHandlerContext {
    return {
        store: createMemoryStore(),
        tools: noopTools,
        dryRun: false,
        stepId: 'test-step',
        ...overrides,
    };
}

function makeDirective(args: Record<string, unknown>): Directive {
    return {
        type: 'validate',
        raw: `@validate ${args['variable']} against schema:${args['schema']}`,
        args,
    };
}

describe('handleValidate', () => {
    it('should pass valid data against schema', () => {
        const ctx = makeCtx({
            store: createMemoryStore({
                result: { summary: 'All good', score: 0.95 },
            }),
            outputSchema: {
                report: {
                    type: 'object',
                    properties: {
                        summary: { type: 'string', minLength: 1 },
                        score: { type: 'number', min: 0, max: 1 },
                    },
                    required: ['summary', 'score'],
                },
            },
        });

        const directive = makeDirective({ variable: '$result', schema: 'report' });
        const result = handleValidate(directive, ctx);

        expect(result.continue).toBe(true);
        expect(result.error).toBeUndefined();
    });

    it('should fail invalid data against schema', () => {
        const ctx = makeCtx({
            store: createMemoryStore({
                result: { summary: '', score: 2.0 },
            }),
            outputSchema: {
                report: {
                    type: 'object',
                    properties: {
                        summary: { type: 'string', minLength: 5 },
                        score: { type: 'number', min: 0, max: 1 },
                    },
                    required: ['summary', 'score'],
                },
            },
        });

        const directive = makeDirective({ variable: '$result', schema: 'report' });
        const result = handleValidate(directive, ctx);

        expect(result.continue).toBe(false);
        expect(result.error).toContain('@validate failed');
    });

    it('should error when variable is not defined', () => {
        const ctx = makeCtx({
            outputSchema: {
                report: { type: 'object' },
            },
        });

        const directive = makeDirective({ variable: '$missing', schema: 'report' });
        const result = handleValidate(directive, ctx);

        expect(result.continue).toBe(false);
        expect(result.error).toContain('not defined');
    });

    it('should error when schema is not found', () => {
        const ctx = makeCtx({
            store: createMemoryStore({ result: 'value' }),
            outputSchema: {},
        });

        const directive = makeDirective({ variable: '$result', schema: 'nonexistent' });
        const result = handleValidate(directive, ctx);

        expect(result.continue).toBe(false);
        expect(result.error).toContain('not found');
    });

    it('should error when no outputSchema is available', () => {
        const ctx = makeCtx({
            store: createMemoryStore({ result: 'value' }),
        });

        const directive = makeDirective({ variable: '$result', schema: 'report' });
        const result = handleValidate(directive, ctx);

        expect(result.continue).toBe(false);
        expect(result.error).toContain('not found');
    });

    it('should validate nested object schemas', () => {
        const ctx = makeCtx({
            store: createMemoryStore({
                data: {
                    user: { name: 'Alice', age: 30 },
                    items: [1, 2, 3],
                },
            }),
            outputSchema: {
                complex: {
                    type: 'object',
                    properties: {
                        user: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                age: { type: 'number', min: 0 },
                            },
                            required: ['name'],
                        },
                        items: {
                            type: 'array',
                            items: { type: 'number' },
                        },
                    },
                    required: ['user'],
                },
            },
        });

        const directive = makeDirective({ variable: '$data', schema: 'complex' });
        const result = handleValidate(directive, ctx);

        expect(result.continue).toBe(true);
    });
});
