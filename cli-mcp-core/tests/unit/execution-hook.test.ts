/**
 * Tests for ExecutionHook port — dispatchHooks utility.
 */

import { describe, it, expect, vi } from 'vitest';
import {
    dispatchHooks,
    HOOK_CONTINUE,
    type ExecutionHook,
    type ExecutionContext,
    type HookResult,
} from '#core/ports/execution-hook.port.js';
import type { Step } from '#core/entities/step.js';

const mockStep: Step = {
    id: 'test-step',
    title: 'Test Step',
    description: '',
    directives: [],
};

const mockCtx: ExecutionContext = {
    workflowName: 'test-workflow',
    dryRun: false,
    variables: {},
};

describe('dispatchHooks', () => {
    it('returns continue when hooks array is empty', async () => {
        const result = await dispatchHooks([], (_h) => undefined);
        expect(result.action).toBe('continue');
    });

    it('returns continue when no hook implements the method', async () => {
        const hook: ExecutionHook = { name: 'noop', priority: 0 };
        const result = await dispatchHooks([hook], (h) => h.beforeStep?.(mockStep, mockCtx));
        expect(result.action).toBe('continue');
    });

    it('returns continue when all hooks return continue', async () => {
        const hookA: ExecutionHook = {
            name: 'a', priority: 0,
            async beforeStep() { return HOOK_CONTINUE; },
        };
        const hookB: ExecutionHook = {
            name: 'b', priority: 1,
            async beforeStep() { return HOOK_CONTINUE; },
        };
        const result = await dispatchHooks([hookA, hookB], (h) => h.beforeStep?.(mockStep, mockCtx));
        expect(result.action).toBe('continue');
    });

    it('returns skip on first skip and stops iteration', async () => {
        const hookB = vi.fn(async (): Promise<HookResult> => HOOK_CONTINUE);
        const hookA: ExecutionHook = {
            name: 'a', priority: 0,
            async beforeStep(): Promise<HookResult> { return { action: 'skip' }; },
        };
        const hookedB: ExecutionHook = { name: 'b', priority: 1, beforeStep: hookB };

        const result = await dispatchHooks([hookA, hookedB], (h) => h.beforeStep?.(mockStep, mockCtx));

        expect(result.action).toBe('skip');
        expect(hookB).not.toHaveBeenCalled();
    });

    it('returns abort with reason on first abort and stops iteration', async () => {
        const hookB = vi.fn(async (): Promise<HookResult> => HOOK_CONTINUE);
        const hookA: ExecutionHook = {
            name: 'guard', priority: 0,
            async beforeStep(): Promise<HookResult> {
                return { action: 'abort', reason: 'test abort' };
            },
        };
        const hookedB: ExecutionHook = { name: 'b', priority: 1, beforeStep: hookB };

        const result = await dispatchHooks([hookA, hookedB], (h) => h.beforeStep?.(mockStep, mockCtx));

        expect(result.action).toBe('abort');
        if (result.action === 'abort') expect(result.reason).toBe('test abort');
        expect(hookB).not.toHaveBeenCalled();
    });

    it('calls all hooks when all return continue', async () => {
        const calls: string[] = [];
        const makeHook = (name: string): ExecutionHook => ({
            name, priority: 0,
            async afterStep(): Promise<HookResult> { calls.push(name); return HOOK_CONTINUE; },
        });

        await dispatchHooks([makeHook('x'), makeHook('y'), makeHook('z')], (h) => h.afterStep?.(mockStep, { stepId: 'test', status: 'success', duration: 0 }, mockCtx));

        expect(calls).toEqual(['x', 'y', 'z']);
    });

    it('HOOK_CONTINUE is a singleton (no allocation)', () => {
        expect(HOOK_CONTINUE).toBe(HOOK_CONTINUE);
        expect(HOOK_CONTINUE.action).toBe('continue');
    });
});
