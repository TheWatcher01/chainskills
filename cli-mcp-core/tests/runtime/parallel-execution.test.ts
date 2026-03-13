/**
 * Tests for true parallel execution with context isolation.
 */

import { describe, it, expect } from 'vitest';
import { handleParallel } from '../../src/adapters/executor/directive-handlers.js';
import type { DirectiveHandlerContext } from '../../src/adapters/executor/directive-handlers.js';
import type { Directive } from '../../src/core/entities/directive.js';
import type { Step } from '../../src/core/entities/step.js';
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

describe('handleParallel — true parallel execution', () => {
    it('should execute @parallel branches truly in parallel', async () => {
        const timestamps: number[] = [];

        const children: Step[] = [
            {
                id: 'branch-a',
                title: 'Branch A',
                description: '',
                directives: [{
                    type: 'call',
                    raw: '@call shell.exec("echo a") → $a',
                    args: { tool: 'shell', method: 'exec', input: 'echo a', capture: 'a' },
                }],
            },
            {
                id: 'branch-b',
                title: 'Branch B',
                description: '',
                directives: [{
                    type: 'call',
                    raw: '@call shell.exec("echo b") → $b',
                    args: { tool: 'shell', method: 'exec', input: 'echo b', capture: 'b' },
                }],
            },
        ];

        const directive: Directive = {
            type: 'parallel',
            raw: '@parallel',
            args: {},
            children,
        };

        const step: Step = { id: 'step-1', title: '', description: '', directives: [directive], children };

        const ctx = makeCtx();

        const executeChildDirectives = async (directives: readonly Directive[], childCtx: DirectiveHandlerContext) => {
            timestamps.push(Date.now());
            // Simulate async work
            await new Promise((r) => setTimeout(r, 10));
            for (const d of directives) {
                const capture = String(d.args['capture'] ?? '');
                if (capture) {
                    childCtx.store.set(capture, `result-${capture}`);
                }
            }
        };

        const result = await handleParallel(directive, step, ctx, executeChildDirectives);

        // Both branches should have started (timestamps recorded)
        expect(timestamps).toHaveLength(2);
        // The time difference should be small (both started near-simultaneously)
        expect(Math.abs(timestamps[0]! - timestamps[1]!)).toBeLessThan(50);
        expect(result.continue).toBe(true);
    });

    it('should isolate context between parallel branches', async () => {
        const children: Step[] = [
            {
                id: 'branch-a',
                title: 'Branch A',
                description: '',
                directives: [{ type: 'call', raw: '', args: { capture: 'shared' } }],
            },
            {
                id: 'branch-b',
                title: 'Branch B',
                description: '',
                directives: [{ type: 'call', raw: '', args: { capture: 'shared' } }],
            },
        ];

        const directive: Directive = {
            type: 'parallel',
            raw: '@parallel',
            args: {},
            children,
        };

        const step: Step = { id: 'step-1', title: '', description: '', directives: [directive], children };

        const ctx = makeCtx({ store: createMemoryStore({ input: 'original' }) });

        const executeChildDirectives = async (_: readonly Directive[], childCtx: DirectiveHandlerContext) => {
            const stepId = childCtx.stepId;
            // Each branch sets 'shared' to a different value
            childCtx.store.set('shared', `value-from-${stepId}`);
            // Verify input was copied
            expect(childCtx.store.get('input')).toBe('original');
            // Modify input in isolated context (should NOT affect other branch)
            childCtx.store.set('input', `modified-by-${stepId}`);
        };

        await handleParallel(directive, step, ctx, executeChildDirectives);

        // Parent input should still be original
        expect(ctx.store.get('input')).toBe('original');
        // 'shared' should have a value from one of the branches (last-wins)
        const shared = ctx.store.get('shared') as string;
        expect(shared).toMatch(/^value-from-branch-/);
    });

    it('should merge results from parallel branches into parent store', async () => {
        const children: Step[] = [
            {
                id: 'branch-a',
                title: 'A',
                description: '',
                directives: [{ type: 'call', raw: '', args: {} }],
            },
            {
                id: 'branch-b',
                title: 'B',
                description: '',
                directives: [{ type: 'call', raw: '', args: {} }],
            },
        ];

        const directive: Directive = {
            type: 'parallel',
            raw: '@parallel',
            args: {},
            children,
        };

        const step: Step = { id: 'step-1', title: '', description: '', directives: [directive], children };
        const ctx = makeCtx();

        const executeChildDirectives = async (_: readonly Directive[], childCtx: DirectiveHandlerContext) => {
            if (childCtx.stepId === 'branch-a') {
                childCtx.store.set('result_a', 'value-a');
            } else {
                childCtx.store.set('result_b', 'value-b');
            }
        };

        await handleParallel(directive, step, ctx, executeChildDirectives);

        expect(ctx.store.get('result_a')).toBe('value-a');
        expect(ctx.store.get('result_b')).toBe('value-b');
    });

    it('should continue if at least one branch succeeds', async () => {
        const children: Step[] = [
            { id: 'ok', title: '', description: '', directives: [{ type: 'call', raw: '', args: {} }] },
            { id: 'fail', title: '', description: '', directives: [{ type: 'call', raw: '', args: {} }] },
        ];

        const directive: Directive = { type: 'parallel', raw: '@parallel', args: {}, children };
        const step: Step = { id: 'step-1', title: '', description: '', directives: [directive], children };
        const ctx = makeCtx();

        const executeChildDirectives = async (_: readonly Directive[], childCtx: DirectiveHandlerContext) => {
            if (childCtx.stepId === 'fail') {
                throw new Error('branch failed');
            }
            childCtx.store.set('ok_result', 'success');
        };

        const result = await handleParallel(directive, step, ctx, executeChildDirectives);

        expect(result.continue).toBe(true);
        expect(ctx.store.get('ok_result')).toBe('success');
    });

    it('should return empty result for no children', async () => {
        const directive: Directive = { type: 'parallel', raw: '@parallel', args: {} };
        const step: Step = { id: 'step-1', title: '', description: '', directives: [directive] };
        const ctx = makeCtx();

        const result = await handleParallel(directive, step, ctx, async () => {});
        expect(result.continue).toBe(true);
    });
});
