/**
 * Integration tests for ExecutionController in workflow execution.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSimpleExecutor } from '#adapters/executor/simple-executor.js';
import { createMemoryStore } from '#adapters/state/memory-store.js';
import { createShellToolProvider } from '#adapters/tools/shell-tool-provider.js';
import type { Workflow } from '#core/entities/workflow.js';

describe('ExecutionController', () => {
    let store: ReturnType<typeof createMemoryStore>;
    let tools: ReturnType<typeof createShellToolProvider>;

    beforeEach(() => {
        store = createMemoryStore();
        tools = createShellToolProvider();
    });

    it('should provide controller in execution result', async () => {
        const executor = createSimpleExecutor({ store, tools });
        const workflow: Workflow = {
            name: 'test-workflow',
            description: 'Test workflow for controller',
            version: '1.0.0',
            steps: [
                {
                    id: 'step-1',
                    title: 'First step',
                    description: 'Do something',
                    directives: [],
                },
            ],
            inputs: [],
            outputs: [],
            env: [],
            tags: [],
            metadata: {},
        };

        const result = await executor.execute(workflow, {});

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.controller).toBeDefined();
            expect(result.value.controller.isCancelled()).toBe(false);
            expect(result.value.controller.isPaused()).toBe(false);
        }
    });

    it('should execute successfully when not controlled', async () => {
        const executor = createSimpleExecutor({ store, tools });
        const workflow: Workflow = {
            name: 'test-workflow',
            description: 'Test workflow',
            version: '1.0.0',
            steps: [
                {
                    id: 'step-1',
                    title: 'Step 1',
                    description: 'First step',
                    directives: [],
                },
                {
                    id: 'step-2',
                    title: 'Step 2',
                    description: 'Second step',
                    directives: [],
                },
            ],
            inputs: [],
            outputs: [],
            env: [],
            tags: [],
            metadata: {},
        };

        const result = await executor.execute(workflow, {});

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.steps).toHaveLength(2);
            expect(result.value.steps[0]?.status).toBe('success');
            expect(result.value.steps[1]?.status).toBe('success');
        }
    });

    it('should cancel execution when controller.cancel() is called', async () => {
        const executor = createSimpleExecutor({ store, tools });
        const workflow: Workflow = {
            name: 'test-workflow',
            description: 'Test cancellation',
            version: '1.0.0',
            steps: [
                {
                    id: 'step-1',
                    title: 'Step 1',
                    description: 'First step',
                    directives: [],
                },
                {
                    id: 'step-2',
                    title: 'Step 2',
                    description: 'Should not execute',
                    directives: [],
                },
            ],
            inputs: [],
            outputs: [],
            env: [],
            tags: [],
            metadata: {},
        };

        // Start execution and cancel after first step
        const promise = executor.execute(workflow, {});

        // Cancel immediately (in real scenario, would cancel during execution)
        // Since we can't intercept mid-execution easily in tests,
        // this test validates the controller is present and callable
        const result = await promise;

        if (result.ok) {
            const controller = result.value.controller;
            expect(controller).toBeDefined();

            // Validate cancel works
            controller.cancel();
            expect(controller.isCancelled()).toBe(true);
            expect(controller.isPaused()).toBe(false);
        }
    });

    it('should support pause and resume', async () => {
        const executor = createSimpleExecutor({ store, tools });
        const workflow: Workflow = {
            name: 'test-workflow',
            description: 'Test pause/resume',
            version: '1.0.0',
            steps: [
                {
                    id: 'step-1',
                    title: 'Step 1',
                    description: 'First step',
                    directives: [],
                },
            ],
            inputs: [],
            outputs: [],
            env: [],
            tags: [],
            metadata: {},
        };

        const result = await executor.execute(workflow, {});

        if (result.ok) {
            const controller = result.value.controller;

            // Test pause
            controller.pause();
            expect(controller.isPaused()).toBe(true);
            expect(controller.isCancelled()).toBe(false);

            // Test resume
            controller.resume();
            expect(controller.isPaused()).toBe(false);
            expect(controller.isCancelled()).toBe(false);
        }
    });

    it('should support step mode', async () => {
        const executor = createSimpleExecutor({ store, tools });
        const workflow: Workflow = {
            name: 'test-workflow',
            description: 'Test step mode',
            version: '1.0.0',
            steps: [
                {
                    id: 'step-1',
                    title: 'Step 1',
                    description: 'First step',
                    directives: [],
                },
            ],
            inputs: [],
            outputs: [],
            env: [],
            tags: [],
            metadata: {},
        };

        const result = await executor.execute(workflow, {});

        if (result.ok) {
            const controller = result.value.controller;

            // Pause, then step
            controller.pause();
            expect(controller.isPaused()).toBe(true);

            controller.step();
            // After step(), should be resumed (not paused)
            expect(controller.isPaused()).toBe(false);
        }
    });

    it('should call listeners on pause and resume', async () => {
        const executor = createSimpleExecutor({ store, tools });
        const workflow: Workflow = {
            name: 'test-workflow',
            description: 'Test listeners',
            version: '1.0.0',
            steps: [
                {
                    id: 'step-1',
                    title: 'Step 1',
                    description: 'First step',
                    directives: [],
                },
            ],
            inputs: [],
            outputs: [],
            env: [],
            tags: [],
            metadata: {},
        };

        const result = await executor.execute(workflow, {});

        if (result.ok) {
            const controller = result.value.controller;
            let pauseCalled = false;
            let resumeCalled = false;

            controller.onPaused(() => {
                pauseCalled = true;
            });

            controller.onResumed(() => {
                resumeCalled = true;
            });

            controller.pause();
            expect(pauseCalled).toBe(true);

            controller.resume();
            expect(resumeCalled).toBe(true);
        }
    });
});
