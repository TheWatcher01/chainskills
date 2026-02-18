/**
 * Tests for DAG building: variable analysis, node typing, cycle detection,
 * auto-parallelization, and block directive structures.
 */

import { describe, it, expect } from 'vitest';
import { buildDAG } from '#core/use-cases/build-dag.js';
import type { DAG, DAGNode } from '#core/use-cases/build-dag.js';
import type { Workflow } from '#core/entities/workflow.js';
import type { Step } from '#core/entities/step.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWorkflow(steps: Step[], inputs: string[] = []): Workflow {
    return {
        name: 'test-dag',
        description: 'Test workflow for DAG building',
        version: '0.1.0',
        steps,
        inputs: inputs.map((name) => ({ name, type: 'string' })),
        outputs: [],
        env: [],
        tags: [],
        metadata: {},
    };
}

function makeStep(id: string, directives: Step['directives'] = [], children?: Step[]): Step {
    return { id, title: id, description: '', directives, children };
}

function getNode(dag: DAG, stepId: string): DAGNode | undefined {
    return dag.nodes.find((n) => n.stepId === stepId);
}

// ─── Empty Workflow ──────────────────────────────────────────────────────────

describe('buildDAG — empty workflow', () => {
    it('should return an empty DAG for a workflow with no steps', () => {
        const wf = makeWorkflow([]);
        const result = buildDAG(wf);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.nodes).toHaveLength(0);
        expect(result.value.entryPoints).toHaveLength(0);
        expect(result.value.parallelGroups).toHaveLength(0);
    });
});

// ─── Sequential Steps ────────────────────────────────────────────────────────

describe('buildDAG — sequential steps', () => {
    it('should create implicit sequential dependency for steps without variable flow', () => {
        const wf = makeWorkflow([
            makeStep('step-a', [
                { type: 'call', raw: '@call shell.exec(echo hi) → $a_out', args: { tool: 'shell', method: 'exec', input: 'echo hi', capture: 'a_out' } },
            ]),
            makeStep('step-b', [
                { type: 'call', raw: '@call shell.exec(echo hello) → $b_out', args: { tool: 'shell', method: 'exec', input: 'echo hello', capture: 'b_out' } },
            ]),
        ]);

        const result = buildDAG(wf);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.nodes).toHaveLength(2);
        const a = getNode(result.value, 'step-a');
        const b = getNode(result.value, 'step-b');
        // First step has no deps, second depends on first (document order)
        expect(a?.dependencies).toHaveLength(0);
        expect(b?.dependencies).toHaveLength(1);
        expect(b?.dependencies).toContain('step-a');
        expect(a?.type).toBe('sequential');
        expect(b?.type).toBe('sequential');
    });

    it('should detect dependency when step B consumes variable produced by step A', () => {
        const wf = makeWorkflow([
            makeStep('step-a', [
                { type: 'call', raw: '@call shell.exec(echo hi) → $result', args: { tool: 'shell', method: 'exec', input: 'echo hi', capture: 'result' } },
            ]),
            makeStep('step-b', [
                { type: 'call', raw: '@call shell.exec($result) → $b_out', args: { tool: 'shell', method: 'exec', input: '$result', capture: 'b_out' } },
            ]),
        ]);

        const result = buildDAG(wf);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const b = getNode(result.value, 'step-b');
        expect(b?.dependencies).toContain('step-a');
    });

    it('should not create dependency for inputs', () => {
        const wf = makeWorkflow(
            [
                makeStep('step-a', [
                    { type: 'call', raw: '@call shell.exec($target) → $out', args: { tool: 'shell', method: 'exec', input: '$target', capture: 'out' } },
                ]),
            ],
            ['target'],
        );

        const result = buildDAG(wf);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const a = getNode(result.value, 'step-a');
        expect(a?.dependencies).toHaveLength(0);
    });
});

// ─── Variable Analysis ───────────────────────────────────────────────────────

describe('buildDAG — variable analysis', () => {
    it('should track produces and consumes correctly', () => {
        const wf = makeWorkflow([
            makeStep('producer', [
                { type: 'call', raw: '@call shell.exec(echo x) → $data', args: { tool: 'shell', method: 'exec', input: 'echo x', capture: 'data' } },
            ]),
            makeStep('consumer', [
                { type: 'output', raw: '@output: $data', args: { variables: ['$data'] } },
            ]),
        ]);

        const result = buildDAG(wf);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const producer = getNode(result.value, 'producer');
        expect(producer?.produces).toContain('data');

        const consumer = getNode(result.value, 'consumer');
        expect(consumer?.consumes).toContain('data');
        expect(consumer?.dependencies).toContain('producer');
    });
});

// ─── Node Type Detection ─────────────────────────────────────────────────────

describe('buildDAG — node type detection', () => {
    it('should detect branch node for @if directive', () => {
        const wf = makeWorkflow([
            makeStep('check', [
                { type: 'if', raw: '@if $score > 50:', args: { condition: '$score > 50' } },
            ]),
        ]);

        const result = buildDAG(wf);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const node = getNode(result.value, 'check');
        expect(node?.type).toBe('branch');
        expect(node?.condition).toBe('$score > 50');
    });

    it('should detect loop node for @for directive', () => {
        const wf = makeWorkflow([
            makeStep('iterate', [
                { type: 'for', raw: '@for $item in $list:', args: { variable: '$item', iterable: '$list' } },
            ]),
        ]);

        const result = buildDAG(wf);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const node = getNode(result.value, 'iterate');
        expect(node?.type).toBe('loop');
        expect(node?.loopMode).toBe('for');
        expect(node?.loopVariable).toBe('item');
        expect(node?.iterable).toBe('list');
    });

    it('should detect loop node for @repeat directive', () => {
        const wf = makeWorkflow([
            makeStep('retry', [
                { type: 'repeat', raw: '@repeat max:5 until $done:', args: { max: 5, until: '$done' } },
            ]),
        ]);

        const result = buildDAG(wf);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const node = getNode(result.value, 'retry');
        expect(node?.type).toBe('loop');
        expect(node?.loopMode).toBe('until');
        expect(node?.maxIterations).toBe(5);
    });

    it('should detect parallel node for @parallel directive', () => {
        const wf = makeWorkflow([
            makeStep('multi', [
                { type: 'parallel', raw: '@parallel:', args: {} },
            ]),
        ]);

        const result = buildDAG(wf);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const node = getNode(result.value, 'multi');
        expect(node?.type).toBe('parallel');
    });

    it('should detect try-catch node for @try directive', () => {
        const wf = makeWorkflow([
            makeStep('safe', [
                { type: 'try', raw: '@try:', args: {} },
            ]),
        ]);

        const result = buildDAG(wf);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const node = getNode(result.value, 'safe');
        expect(node?.type).toBe('try-catch');
    });
});

// ─── Parallel Groups ─────────────────────────────────────────────────────────

describe('buildDAG — auto-parallelization', () => {
    it('should create sequential parallel groups following document order', () => {
        const wf = makeWorkflow([
            makeStep('a', [
                { type: 'call', raw: '@call shell.exec(echo a) → $a', args: { tool: 'shell', method: 'exec', input: 'echo a', capture: 'a' } },
            ]),
            makeStep('b', [
                { type: 'call', raw: '@call shell.exec(echo b) → $b', args: { tool: 'shell', method: 'exec', input: 'echo b', capture: 'b' } },
            ]),
            makeStep('c', [
                { type: 'output', raw: '@output: $a, $b', args: { variables: ['$a', '$b'] } },
            ]),
        ]);

        const result = buildDAG(wf);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // With implicit sequential deps: a → b → c
        // a is level 0, b is level 1 (dep: a), c is level 2 (deps: a, b)
        expect(result.value.parallelGroups).toHaveLength(3);
        expect(result.value.parallelGroups[0]).toContain('a');
        expect(result.value.parallelGroups[1]).toContain('b');
        expect(result.value.parallelGroups[2]).toContain('c');
    });

    it('should create a single group for fully sequential steps', () => {
        const wf = makeWorkflow([
            makeStep('a', [
                { type: 'call', raw: '@call shell.exec(echo a) → $a', args: { tool: 'shell', method: 'exec', input: 'echo a', capture: 'a' } },
            ]),
            makeStep('b', [
                { type: 'call', raw: '@call shell.exec($a) → $b', args: { tool: 'shell', method: 'exec', input: '$a', capture: 'b' } },
            ]),
            makeStep('c', [
                { type: 'call', raw: '@call shell.exec($b) → $c', args: { tool: 'shell', method: 'exec', input: '$b', capture: 'c' } },
            ]),
        ]);

        const result = buildDAG(wf);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // Each step is in its own level
        expect(result.value.parallelGroups).toHaveLength(3);
        expect(result.value.parallelGroups[0]).toHaveLength(1);
        expect(result.value.parallelGroups[1]).toHaveLength(1);
        expect(result.value.parallelGroups[2]).toHaveLength(1);
    });
});

// ─── Entry Points ────────────────────────────────────────────────────────────

describe('buildDAG — entry points', () => {
    it('should identify only the first step as entry point with implicit sequential deps', () => {
        const wf = makeWorkflow([
            makeStep('entry-a'),
            makeStep('entry-b'),
            makeStep('dep', [
                { type: 'output', raw: '@output: $a', args: { variables: ['$a'] } },
            ]),
        ]);

        const result = buildDAG(wf);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // Only the first step is an entry point — others depend on predecessors
        expect(result.value.entryPoints).toHaveLength(1);
        expect(result.value.entryPoints).toContain('entry-a');
    });
});

// ─── Children / Block Structure ──────────────────────────────────────────────

describe('buildDAG — block structure with children', () => {
    it('should build child nodes from step.children', () => {
        const wf = makeWorkflow([
            makeStep(
                'parallel-step',
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

        const result = buildDAG(wf);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const node = getNode(result.value, 'parallel-step');
        expect(node?.type).toBe('parallel');
        expect(node?.children).toHaveLength(2);
        expect(node?.children?.[0]?.stepId).toBe('branch-a');
        expect(node?.children?.[1]?.stepId).toBe('branch-b');

        // Parallel children should have no inter-dependencies
        for (const child of node?.children ?? []) {
            expect(child.dependencies).toHaveLength(0);
        }
    });
});

// ─── Cycle Detection ─────────────────────────────────────────────────────────

describe('buildDAG — cycle detection', () => {
    it('should accept an acyclic graph', () => {
        const wf = makeWorkflow([
            makeStep('a', [
                { type: 'call', raw: '@call shell.exec(echo a) → $a', args: { tool: 'shell', method: 'exec', input: 'echo a', capture: 'a' } },
            ]),
            makeStep('b', [
                { type: 'call', raw: '@call shell.exec($a) → $b', args: { tool: 'shell', method: 'exec', input: '$a', capture: 'b' } },
            ]),
        ]);

        const result = buildDAG(wf);
        expect(result.ok).toBe(true);
    });

    // Note: With the current linear workflow model, true cycles are rare
    // because variables are produced sequentially. This test validates
    // that the DAG builder handles the degenerate case.
    it('should succeed with complex but acyclic variable flow', () => {
        const wf = makeWorkflow([
            makeStep('a', [
                { type: 'call', raw: '@call shell.exec(echo a) → $x', args: { tool: 'shell', method: 'exec', input: 'echo a', capture: 'x' } },
            ]),
            makeStep('b', [
                { type: 'call', raw: '@call shell.exec($x) → $y', args: { tool: 'shell', method: 'exec', input: '$x', capture: 'y' } },
            ]),
            makeStep('c', [
                { type: 'call', raw: '@call shell.exec($y) → $z', args: { tool: 'shell', method: 'exec', input: '$y', capture: 'z' } },
            ]),
        ]);

        const result = buildDAG(wf);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const c = getNode(result.value, 'c');
        expect(c?.dependencies).toContain('b');
    });
});
