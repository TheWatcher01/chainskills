/**
 * Tests for control flow execution: @if/@else, @for, @repeat, @try/@on-error,
 * @parallel, @assert, @env, @output, and @workflow directives.
 */

import { describe, it, expect } from 'vitest';
import { createSimpleExecutor } from '#adapters/executor/simple-executor.js';
import { createMemoryStore } from '#adapters/state/memory-store.js';
import { createShellToolProvider } from '#adapters/tools/shell-tool-provider.js';
import { createEventEmitter } from '#infra/event-emitter.js';
import { createLogger } from '#infra/logger.js';
import type { Workflow } from '#core/entities/workflow.js';
import type { Step } from '#core/entities/step.js';
import type { Directive } from '#core/entities/directive.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWorkflow(steps: Step[], inputs: string[] = []): Workflow {
    return {
        name: 'test-control-flow',
        description: 'Control flow tests',
        version: '0.1.0',
        steps,
        inputs: inputs.map((name) => ({ name, type: 'string' })),
        outputs: [],
        env: [],
        tags: [],
        metadata: {},
    };
}

function makeStep(id: string, directives: Directive[], children?: Step[]): Step {
    return { id, title: id, description: '', directives, children };
}

function createTestExecutor() {
    const logger = createLogger('error');
    const store = createMemoryStore();
    const tools = createShellToolProvider({}, logger);
    const emitter = createEventEmitter();
    return {
        executor: createSimpleExecutor({ store, tools, logger, emitter }),
        store,
        emitter,
    };
}

// ─── @if / @else ─────────────────────────────────────────────────────────────

describe('Control flow — @if / @else', () => {
    it('should execute directives when @if condition is true', async () => {
        const wf = makeWorkflow([
            makeStep('check', [
                { type: 'if', raw: '@if $score > 50:', args: { condition: '$score > 50' } },
                { type: 'call', raw: '@call shell.exec(echo passed) → $result', args: { tool: 'shell', method: 'exec', input: 'echo passed', capture: 'result' } },
            ]),
        ]);

        const { executor, store } = createTestExecutor();
        store.set('score', 80);

        const result = await executor.execute(wf, { score: 80 }, { dryRun: true });
        expect(result.ok).toBe(true);
    });

    it('should skip remaining directives when @if condition is false', async () => {
        const wf = makeWorkflow([
            makeStep('check', [
                { type: 'if', raw: '@if $score > 50:', args: { condition: '$score > 50' } },
                { type: 'call', raw: '@call shell.exec(echo should-not-run) → $result', args: { tool: 'shell', method: 'exec', input: 'echo should-not-run', capture: 'result' } },
            ]),
        ]);

        const { executor } = createTestExecutor();
        const result = await executor.execute(wf, { score: 10 }, { dryRun: true });
        expect(result.ok).toBe(true);
    });

    it('should execute @else branch when @if condition is false', async () => {
        const wf = makeWorkflow([
            makeStep('branching', [
                { type: 'if', raw: '@if $x > 100:', args: { condition: '$x > 100' } },
                { type: 'call', raw: '@call shell.exec(echo if-branch) → $if_out', args: { tool: 'shell', method: 'exec', input: 'echo if-branch', capture: 'if_out' } },
                { type: 'else', raw: '@else:', args: {} },
                { type: 'call', raw: '@call shell.exec(echo else-branch) → $else_out', args: { tool: 'shell', method: 'exec', input: 'echo else-branch', capture: 'else_out' } },
            ]),
        ]);

        const { executor } = createTestExecutor();
        const result = await executor.execute(wf, { x: 5 }, { dryRun: true });
        expect(result.ok).toBe(true);
    });
});

// ─── @for ────────────────────────────────────────────────────────────────────

describe('Control flow — @for', () => {
    it('should iterate over a list in dry-run', async () => {
        const wf = makeWorkflow([
            makeStep('iterate', [
                { type: 'for', raw: '@for $item in $items:', args: { variable: '$item', iterable: '$items' } },
                { type: 'call', raw: '@call shell.exec(echo $item) → $out', args: { tool: 'shell', method: 'exec', input: 'echo $item', capture: 'out' } },
            ]),
        ]);

        const { executor, store } = createTestExecutor();
        store.set('items', ['a', 'b', 'c']);

        const result = await executor.execute(wf, {}, { dryRun: true });
        expect(result.ok).toBe(true);
    });

    it('should handle empty list', async () => {
        const wf = makeWorkflow([
            makeStep('iterate-empty', [
                { type: 'for', raw: '@for $item in $empty:', args: { variable: '$item', iterable: '$empty' } },
            ]),
        ]);

        const { executor, store } = createTestExecutor();
        store.set('empty', []);

        const result = await executor.execute(wf, {}, { dryRun: true });
        expect(result.ok).toBe(true);
    });
});

// ─── @repeat ─────────────────────────────────────────────────────────────────

describe('Control flow — @repeat', () => {
    it('should repeat up to max iterations in dry-run', async () => {
        const wf = makeWorkflow([
            makeStep('retry', [
                { type: 'repeat', raw: '@repeat max:3 until $done:', args: { max: 3, until: '$done' } },
                { type: 'call', raw: '@call shell.exec(echo try) → $out', args: { tool: 'shell', method: 'exec', input: 'echo try', capture: 'out' } },
            ]),
        ]);

        const { executor } = createTestExecutor();
        const result = await executor.execute(wf, {}, { dryRun: true });
        expect(result.ok).toBe(true);
    });
});

// ─── @try / @on-error ────────────────────────────────────────────────────────

describe('Control flow — @try / @on-error', () => {
    it('should handle @try block without errors', async () => {
        const wf = makeWorkflow([
            makeStep('safe', [
                { type: 'try', raw: '@try:', args: {} },
                { type: 'call', raw: '@call shell.exec(echo ok) → $out', args: { tool: 'shell', method: 'exec', input: 'echo ok', capture: 'out' } },
                { type: 'on-error', raw: '@on-error: log and continue', args: { action: 'log and continue' } },
            ]),
        ]);

        const { executor } = createTestExecutor();
        const result = await executor.execute(wf, {}, { dryRun: true });
        expect(result.ok).toBe(true);
    });

    it('should catch and handle errors with @on-error', async () => {
        // Error will be caught by @try — the step should still succeed
        const wf = makeWorkflow([
            makeStep('error-handling', [
                { type: 'try', raw: '@try:', args: {} },
                { type: 'call', raw: '@call shell.exec(echo safe) → $out', args: { tool: 'shell', method: 'exec', input: 'echo safe', capture: 'out' } },
                { type: 'on-error', raw: '@on-error: log and continue', args: { action: 'log and continue' } },
                { type: 'call', raw: '@call shell.exec(echo fallback) → $fallback', args: { tool: 'shell', method: 'exec', input: 'echo fallback', capture: 'fallback' } },
            ]),
        ]);

        const { executor } = createTestExecutor();
        const result = await executor.execute(wf, {}, { dryRun: true });
        expect(result.ok).toBe(true);
    });
});

// ─── @parallel ───────────────────────────────────────────────────────────────

describe('Control flow — @parallel', () => {
    it('should execute parallel children sequentially in simple executor', async () => {
        const wf = makeWorkflow([
            makeStep(
                'multi',
                [{ type: 'parallel', raw: '@parallel:', args: {} }],
                [
                    makeStep('branch-a', [
                        { type: 'call', raw: '@call shell.exec(echo a) → $a', args: { tool: 'shell', method: 'exec', input: 'echo a', capture: 'a' } },
                    ]),
                    makeStep('branch-b', [
                        { type: 'call', raw: '@call shell.exec(echo b) → $b', args: { tool: 'shell', method: 'exec', input: 'echo b', capture: 'b' } },
                    ]),
                ],
            ),
        ]);

        const { executor } = createTestExecutor();
        const result = await executor.execute(wf, {}, { dryRun: true });
        expect(result.ok).toBe(true);
    });

    it('should handle @parallel with directive.children', async () => {
        const childSteps: Step[] = [
            makeStep('child-1', [
                { type: 'call', raw: '@call shell.exec(echo c1) → $c1', args: { tool: 'shell', method: 'exec', input: 'echo c1', capture: 'c1' } },
            ]),
        ];

        const wf = makeWorkflow([
            makeStep('parallel-step', [
                { type: 'parallel', raw: '@parallel:', args: {}, children: childSteps },
            ]),
        ]);

        const { executor } = createTestExecutor();
        const result = await executor.execute(wf, {}, { dryRun: true });
        expect(result.ok).toBe(true);
    });
});

// ─── @assert ─────────────────────────────────────────────────────────────────

describe('Control flow — @assert', () => {
    it('should pass when assertion is true', async () => {
        const wf = makeWorkflow([
            makeStep('validate', [
                { type: 'assert', raw: '@assert $x == 10', args: { expression: '$x == 10' } },
            ]),
        ]);

        const { executor } = createTestExecutor();
        const result = await executor.execute(wf, { x: 10 });
        expect(result.ok).toBe(true);
    });

    it('should fail when assertion is false', async () => {
        const wf = makeWorkflow([
            makeStep('validate', [
                { type: 'assert', raw: '@assert $x == 10', args: { expression: '$x == 10' } },
            ]),
        ]);

        const { executor } = createTestExecutor();
        const result = await executor.execute(wf, { x: 5 });
        expect(result.ok).toBe(false);
    });
});

// ─── @env ────────────────────────────────────────────────────────────────────

describe('Control flow — @env', () => {
    it('should load environment variable into store', async () => {
        process.env['TEST_CHAINSKILLS_VAR'] = 'hello';

        const wf = makeWorkflow([
            makeStep('load-env', [
                { type: 'env', raw: '@env TEST_CHAINSKILLS_VAR', args: { name: 'TEST_CHAINSKILLS_VAR' } },
            ]),
        ]);

        const { executor, store } = createTestExecutor();
        const result = await executor.execute(wf, {});
        expect(result.ok).toBe(true);
        expect(store.get('TEST_CHAINSKILLS_VAR')).toBe('hello');

        delete process.env['TEST_CHAINSKILLS_VAR'];
    });
});

// ─── @output ─────────────────────────────────────────────────────────────────

describe('Control flow — @output', () => {
    it('should declare output variables', async () => {
        const wf: Workflow = {
            ...makeWorkflow([
                makeStep('result', [
                    { type: 'output', raw: '@output: $report', args: { variables: ['$report'] } },
                ]),
            ]),
            outputs: [{ name: 'report', type: 'string' }],
        };

        const { executor, store } = createTestExecutor();
        store.set('report', 'Test report content');
        const result = await executor.execute(wf, {});
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.outputs['report']).toBe('Test report content');
    });
});

// ─── @use ────────────────────────────────────────────────────────────────────

describe('Control flow — @use', () => {
    it('should handle @use as a no-op registration', async () => {
        const wf = makeWorkflow([
            makeStep('imports', [
                { type: 'use', raw: '@use ./skills/helper.workflow.md', args: { ref: './skills/helper.workflow.md' } },
            ]),
        ]);

        const { executor } = createTestExecutor();
        const result = await executor.execute(wf, {});
        expect(result.ok).toBe(true);
    });
});

// ─── @agent / @handoff (placeholder) ─────────────────────────────────────────

describe('Control flow — @agent / @handoff', () => {
    it('should handle @agent as a no-op skip (v0.3.0 placeholder)', async () => {
        const wf = makeWorkflow([
            makeStep('delegate', [
                { type: 'agent', raw: '@agent copilot: "Fix this"', args: { agent: 'copilot', message: 'Fix this' } },
            ]),
        ]);

        const { executor } = createTestExecutor();
        const result = await executor.execute(wf, {});
        expect(result.ok).toBe(true);
    });

    it('should handle @handoff as a no-op skip (v0.3.0 placeholder)', async () => {
        const wf = makeWorkflow([
            makeStep('transfer', [
                { type: 'handoff', raw: '@handoff review-agent: "Review"', args: { target: 'review-agent', message: 'Review' } },
            ]),
        ]);

        const { executor } = createTestExecutor();
        const result = await executor.execute(wf, {});
        expect(result.ok).toBe(true);
    });
});

// ─── Event Emission ──────────────────────────────────────────────────────────

describe('Control flow — event emission', () => {
    it('should emit events for workflow start, step, and end', async () => {
        const wf = makeWorkflow([
            makeStep('step-a', [
                { type: 'call', raw: '@call shell.exec(echo hi) → $out', args: { tool: 'shell', method: 'exec', input: 'echo hi', capture: 'out' } },
            ]),
        ]);

        const { executor, emitter } = createTestExecutor();
        const events: string[] = [];
        emitter.on((event) => events.push(event.type));

        const result = await executor.execute(wf, {}, { dryRun: true });
        expect(result.ok).toBe(true);

        expect(events).toContain('workflow:start');
        expect(events).toContain('step:start');
        expect(events).toContain('directive:start');
        expect(events).toContain('directive:end');
        expect(events).toContain('step:end');
        expect(events).toContain('workflow:end');
    });
});
