/**
 * Integration test: workflow execution with simple executor.
 */

import { describe, it, expect } from 'vitest';
import { createSimpleExecutor } from '#adapters/executor/simple-executor.js';
import { createMemoryStore } from '#adapters/state/memory-store.js';
import { createShellToolProvider } from '#adapters/tools/shell-tool-provider.js';
import type { Workflow } from '#core/entities/workflow.js';
import type { Step } from '#core/entities/step.js';

/** Build a minimal workflow for testing. */
function makeTestWorkflow(steps: Step[]): Workflow {
    return {
        name: 'test-workflow',
        description: 'Test',
        version: '0.1.0',
        steps,
        inputs: [],
        outputs: [],
        env: [],
        tags: [],
        metadata: {},
    };
}

describe('SimpleExecutor', () => {
    it('should execute an empty workflow successfully', async () => {
        const store = createMemoryStore();
        const tools = createShellToolProvider({ dryRun: true });
        const executor = createSimpleExecutor({ store, tools });

        const workflow = makeTestWorkflow([]);
        const result = await executor.execute(workflow, {});

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.steps).toHaveLength(0);
        expect(result.value.duration).toBeGreaterThanOrEqual(0);
    });

    it('should execute a single step workflow', async () => {
        const store = createMemoryStore();
        const tools = createShellToolProvider({ dryRun: true });
        const executor = createSimpleExecutor({ store, tools });

        const workflow = makeTestWorkflow([
            {
                id: 'step-1',
                title: 'First Step',
                description: 'Do something',
                directives: [],
            },
        ]);

        const result = await executor.execute(workflow, {});
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.steps).toHaveLength(1);
        expect(result.value.steps[0]!.stepId).toBe('step-1');
        expect(result.value.steps[0]!.status).toBe('success');
    });

    it('should seed store with inputs', async () => {
        const store = createMemoryStore();
        const tools = createShellToolProvider({ dryRun: true });
        const executor = createSimpleExecutor({ store, tools });

        const workflow = makeTestWorkflow([
            {
                id: 'step-1',
                title: 'Step',
                description: '',
                directives: [],
            },
        ]);

        await executor.execute(workflow, { target: 'src/', verbose: true });

        expect(store.get('target')).toBe('src/');
        expect(store.get('verbose')).toBe(true);
    });

    it('should execute @call in dry-run mode', async () => {
        const store = createMemoryStore();
        const tools = createShellToolProvider({ dryRun: true });
        const executor = createSimpleExecutor({ store, tools });

        const workflow = makeTestWorkflow([
            {
                id: 'run-cmd',
                title: 'Run Command',
                description: '',
                directives: [
                    {
                        type: 'call',
                        raw: '@call shell.exec(echo hello) → $output',
                        args: {
                            tool: 'shell',
                            method: 'exec',
                            input: 'echo hello',
                            capture: 'output',
                        },
                    },
                ],
            },
        ]);

        const result = await executor.execute(workflow, {}, { dryRun: true });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.steps[0]!.status).toBe('success');
        // In dry-run, capture should be set to a placeholder
        expect(store.get('output')).toContain('dry-run');
    });

    it('should handle multi-step sequential execution', async () => {
        const store = createMemoryStore();
        const tools = createShellToolProvider({ dryRun: true });
        const executor = createSimpleExecutor({ store, tools });

        const workflow = makeTestWorkflow([
            {
                id: 'step-1',
                title: 'First',
                description: '',
                directives: [],
            },
            {
                id: 'step-2',
                title: 'Second',
                description: '',
                directives: [],
            },
            {
                id: 'step-3',
                title: 'Third',
                description: '',
                directives: [],
            },
        ]);

        const result = await executor.execute(workflow, {});
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.steps).toHaveLength(3);
        expect(result.value.steps.every((s) => s.status === 'success')).toBe(true);
    });

    it('should collect declared outputs', async () => {
        const store = createMemoryStore({ report: 'test-report' });
        const tools = createShellToolProvider({ dryRun: true });
        const executor = createSimpleExecutor({ store, tools });

        const workflow: Workflow = {
            name: 'output-test',
            description: '',
            version: '0.1.0',
            steps: [
                { id: 's1', title: 'S1', description: '', directives: [] },
            ],
            inputs: [],
            outputs: [{ name: 'report', type: 'string' }],
            env: [],
            tags: [],
            metadata: {},
        };

        const result = await executor.execute(workflow, {});
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.outputs['report']).toBe('test-report');
    });
});
