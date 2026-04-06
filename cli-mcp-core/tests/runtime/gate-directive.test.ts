/**
 * Tests for @gate directive — confidence gating with fallback.
 */

import { describe, it, expect, vi } from 'vitest';
import { handleGate } from '#adapters/executor/directive-handlers.js';
import { createMemoryStore } from '#adapters/state/memory-store.js';
import type { Directive } from '#core/entities/directive.js';
import type { Step } from '#core/entities/step.js';
import type { DirectiveHandlerContext } from '#adapters/executor/directive-handlers.js';

function makeGateDirective(condition: string, elseChildren?: Step[]): Directive {
    const args: Record<string, unknown> = { condition };
    if (elseChildren) args['_elseChildren'] = elseChildren;
    return {
        type: 'gate',
        raw: `@gate ${condition}`,
        args,
    };
}

function makeStep(directives: Directive[] = []): Step {
    return {
        id: 'test-step',
        title: 'Test Step',
        description: '',
        directives,
    };
}

function makeCtx(storeData: Record<string, unknown> = {}): DirectiveHandlerContext {
    return {
        store: createMemoryStore(storeData),
        tools: { call: vi.fn(), has: vi.fn() },
        dryRun: false,
        stepId: 'test-step',
    };
}

const noopExecuteChild = vi.fn(async () => {});

describe('@gate directive', () => {
    it('should pass when condition is true', async () => {
        const ctx = makeCtx({ confidence: 0.9 });
        const directive = makeGateDirective('$confidence > 0.8');
        const step = makeStep([directive]);

        const result = await handleGate(directive, step, ctx, noopExecuteChild);

        expect(result.continue).toBe(true);
        expect(result.conditionResult).toBe(true);
    });

    it('should fail and execute else when condition is false', async () => {
        const executeChild = vi.fn(async () => {});
        const elseChildren: Step[] = [{
            id: 'else-1',
            title: 'Fallback',
            description: '',
            directives: [{
                type: 'call',
                raw: '@call mcp.manual_review($input)',
                args: { tool: 'mcp', method: 'manual_review' },
            }],
        }];

        const ctx = makeCtx({ confidence: 0.3 });
        const directive = makeGateDirective('$confidence > 0.8', elseChildren);
        const step = makeStep([directive]);

        const result = await handleGate(directive, step, ctx, executeChild);

        expect(result.conditionResult).toBe(false);
        expect(executeChild).toHaveBeenCalled();
    });

    it('should support complex conditions with && / ||', async () => {
        const ctx = makeCtx({ confidence: 0.9, approved: true });
        const directive = makeGateDirective('$confidence > 0.8 && $approved == true');
        const step = makeStep([directive]);

        const result = await handleGate(directive, step, ctx, noopExecuteChild);

        expect(result.conditionResult).toBe(true);
    });

    it('should fail with AND when one condition is false', async () => {
        const ctx = makeCtx({ confidence: 0.9, approved: false });
        const directive = makeGateDirective('$confidence > 0.8 && $approved == true');
        const step = makeStep([directive]);

        const result = await handleGate(directive, step, ctx, noopExecuteChild);

        expect(result.conditionResult).toBe(false);
    });

    it('should return error on invalid condition', async () => {
        const ctx = makeCtx({});
        const directive = makeGateDirective('');
        const step = makeStep([directive]);

        const result = await handleGate(directive, step, ctx, noopExecuteChild);

        expect(result.continue).toBe(false);
        expect(result.error).toContain('condition error');
    });

    it('should not execute else children when condition passes', async () => {
        const executeChild = vi.fn(async () => {});
        const elseChildren: Step[] = [{
            id: 'else-1',
            title: 'Should not run',
            description: '',
            directives: [{ type: 'call', raw: '@call noop', args: {} }],
        }];

        const ctx = makeCtx({ score: 0.95 });
        const directive = makeGateDirective('$score > 0.5', elseChildren);
        const step = makeStep([directive]);

        await handleGate(directive, step, ctx, executeChild);

        expect(executeChild).not.toHaveBeenCalled();
    });

    it('should work with truthy variables', async () => {
        const ctx = makeCtx({ is_valid: true });
        const directive = makeGateDirective('$is_valid');
        const step = makeStep([directive]);

        const result = await handleGate(directive, step, ctx, noopExecuteChild);

        expect(result.conditionResult).toBe(true);
    });

    it('should work with falsy variables', async () => {
        const ctx = makeCtx({ is_valid: false });
        const directive = makeGateDirective('$is_valid');
        const step = makeStep([directive]);

        const result = await handleGate(directive, step, ctx, noopExecuteChild);

        expect(result.conditionResult).toBe(false);
    });
});
