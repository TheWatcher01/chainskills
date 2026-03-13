/**
 * Tests for @snapshot / @restore — save and rollback execution state.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSqlitePersistence } from '#adapters/state/sqlite-persistence.js';
import { createSqliteSnapshotManager } from '#adapters/state/sqlite-snapshot-manager.js';
import { createSqliteRunHistory } from '#adapters/state/sqlite-run-history.js';
import { executeDirective, type DirectiveHandlerContext } from '#adapters/executor/directive-handlers.js';
import { createMemoryStore } from '#adapters/state/memory-store.js';
import type { PersistenceStore } from '#core/ports/persistence.port.js';
import type { SnapshotManager } from '#core/ports/snapshot-manager.port.js';
import type { RunHistory } from '#core/ports/run-history.port.js';
import type { Directive } from '#core/entities/directive.js';
import type { Step } from '#core/entities/step.js';

/** Minimal tool provider for tests. */
const noopTools = {
    call: async () => ({ success: true, output: '' }),
    list: async () => [],
};

function makeStep(directives: Directive[]): Step {
    return { id: 'test-step', title: 'Test', description: '', directives };
}

describe('Snapshot Manager (SQLite)', () => {
    let persistence: PersistenceStore;
    let snapshots: SnapshotManager;
    let history: RunHistory;

    beforeEach(() => {
        persistence = createSqlitePersistence(':memory:');
        snapshots = createSqliteSnapshotManager(persistence);
        history = createSqliteRunHistory(persistence);
    });

    it('should save and load a snapshot by ID', () => {
        const runId = history.startRun('test-wf');
        const state = { x: 1, y: 'hello', z: [1, 2, 3] };

        const id = snapshots.save(runId, 'checkpoint-1', state, 'step-1');
        expect(id).toBeGreaterThan(0);

        const loaded = snapshots.load(id);
        expect(loaded).toBeDefined();
        expect(loaded!.label).toBe('checkpoint-1');
        expect(loaded!.state).toEqual(state);
        expect(loaded!.stepId).toBe('step-1');
    });

    it('should load a snapshot by label (most recent)', () => {
        const runId = history.startRun('test-wf');

        snapshots.save(runId, 'before-call', { x: 1 });
        snapshots.save(runId, 'before-call', { x: 2 }); // Override

        const loaded = snapshots.loadByLabel(runId, 'before-call');
        expect(loaded).toBeDefined();
        expect(loaded!.state).toEqual({ x: 2 });
    });

    it('should list all snapshots for a run', () => {
        const runId = history.startRun('test-wf');
        snapshots.save(runId, 'a', { x: 1 });
        snapshots.save(runId, 'b', { x: 2 });
        snapshots.save(runId, 'c', { x: 3 });

        const list = snapshots.listByRun(runId);
        expect(list).toHaveLength(3);
        expect(list.map((s) => s.label)).toEqual(['a', 'b', 'c']);
    });

    it('should return undefined for unknown snapshot', () => {
        expect(snapshots.load(999)).toBeUndefined();
    });

    it('should isolate snapshots between runs', () => {
        const run1 = history.startRun('wf-1');
        const run2 = history.startRun('wf-2');

        snapshots.save(run1, 'x', { a: 1 });
        snapshots.save(run2, 'x', { b: 2 });

        const list1 = snapshots.listByRun(run1);
        const list2 = snapshots.listByRun(run2);
        expect(list1).toHaveLength(1);
        expect(list2).toHaveLength(1);
        expect(list1[0]!.state).toEqual({ a: 1 });
        expect(list2[0]!.state).toEqual({ b: 2 });
    });
});

describe('@snapshot / @restore directives', () => {
    let persistence: PersistenceStore;
    let snapshots: SnapshotManager;
    let history: RunHistory;
    let runId: string;

    beforeEach(() => {
        persistence = createSqlitePersistence(':memory:');
        snapshots = createSqliteSnapshotManager(persistence);
        history = createSqliteRunHistory(persistence);
        runId = history.startRun('test-wf');
    });

    function makeCtx(store: ReturnType<typeof createMemoryStore>): DirectiveHandlerContext {
        return {
            store,
            tools: noopTools,
            dryRun: false,
            stepId: 'snap-step',
            snapshots,
            runId,
        };
    }

    it('should save state with @snapshot', async () => {
        const store = createMemoryStore();
        store.set('x', 42);
        store.set('name', 'test');

        const directive: Directive = {
            type: 'snapshot',
            raw: '@snapshot "before-transform"',
            args: { label: 'before-transform' },
        };

        const step = makeStep([directive]);
        const ctx = makeCtx(store);

        await executeDirective(directive, step, ctx, {
            executeChildDirectives: async () => {},
        });

        const list = snapshots.listByRun(runId);
        expect(list).toHaveLength(1);
        expect(list[0]!.label).toBe('before-transform');
        expect(list[0]!.state).toEqual({ x: 42, name: 'test' });
    });

    it('should restore state with @restore', async () => {
        const store = createMemoryStore();
        store.set('x', 1);
        store.set('y', 2);

        // Save a snapshot
        snapshots.save(runId, 'checkpoint', { x: 1, y: 2 }, 'snap-step');

        // Mutate state
        store.set('x', 100);
        store.set('z', 'new');

        const directive: Directive = {
            type: 'restore',
            raw: '@restore "checkpoint"',
            args: { label: 'checkpoint' },
        };

        const step = makeStep([directive]);
        const ctx = makeCtx(store);

        await executeDirective(directive, step, ctx, {
            executeChildDirectives: async () => {},
        });

        // State should be rolled back
        expect(store.get('x')).toBe(1);
        expect(store.get('y')).toBe(2);
        expect(store.get('z')).toBeUndefined();
    });

    it('should handle @restore with unknown label gracefully', async () => {
        const store = createMemoryStore();
        store.set('x', 42);

        const directive: Directive = {
            type: 'restore',
            raw: '@restore "nonexistent"',
            args: { label: 'nonexistent' },
        };

        const step = makeStep([directive]);
        const ctx = makeCtx(store);

        // Should not throw, but log a warning
        await executeDirective(directive, step, ctx, {
            executeChildDirectives: async () => {},
        });

        // State should remain unchanged
        expect(store.get('x')).toBe(42);
    });

    it('should auto-snapshot and auto-restore on @try error', async () => {
        const store = createMemoryStore();
        store.set('x', 10);
        store.set('y', 20);

        const tryDirective: Directive = {
            type: 'try',
            raw: '@try:',
            args: {},
            children: [{
                id: 'try-child',
                title: '',
                description: '',
                directives: [{
                    type: 'call',
                    raw: '@call fail.tool()',
                    args: { toolName: 'fail', toolArgs: {} },
                }],
            }],
        };

        const onErrorDirective: Directive = {
            type: 'on-error',
            raw: '@on-error: continue',
            args: { action: 'continue' },
        };

        const step = makeStep([tryDirective, onErrorDirective]);
        const ctx = makeCtx(store);

        // Mock tool that fails
        const failTools = {
            call: async () => { throw new Error('Tool exploded'); },
            list: async () => [],
        };

        const failCtx = { ...ctx, tools: failTools };

        await executeDirective(tryDirective, step, failCtx, {
            executeChildDirectives: async (directives, innerCtx) => {
                for (const d of directives) {
                    await innerCtx.tools.call(String(d.args['toolName']), {});
                }
            },
        });

        // State should be restored to pre-try values
        expect(store.get('x')).toBe(10);
        expect(store.get('y')).toBe(20);
        // Error message should still be available
        expect(store.get('_error')).toBe('Tool exploded');
    });

    it('should skip @snapshot in dry run mode', async () => {
        const store = createMemoryStore();
        store.set('x', 1);

        const directive: Directive = {
            type: 'snapshot',
            raw: '@snapshot "test"',
            args: { label: 'test' },
        };

        const step = makeStep([directive]);
        const ctx = { ...makeCtx(store), dryRun: true };

        await executeDirective(directive, step, ctx, {
            executeChildDirectives: async () => {},
        });

        const list = snapshots.listByRun(runId);
        expect(list).toHaveLength(0);
    });
});
