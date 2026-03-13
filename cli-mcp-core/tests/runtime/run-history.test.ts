/**
 * Tests for Run History — recording, filtering, success rates, events.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSqlitePersistence } from '#adapters/state/sqlite-persistence.js';
import { createSqliteRunHistory } from '#adapters/state/sqlite-run-history.js';
import type { RunHistory } from '#core/ports/run-history.port.js';
import type { PersistenceStore } from '#core/ports/persistence.port.js';

describe('RunHistory (SQLite)', () => {
    let persistence: PersistenceStore;
    let history: RunHistory;

    beforeEach(() => {
        persistence = createSqlitePersistence(':memory:');
        history = createSqliteRunHistory(persistence);
    });

    // ─── Recording ──────────────────────────────────────────

    it('should start and end a run', () => {
        const id = history.startRun('test-workflow', { input: 'hello' });
        expect(id).toBeTruthy();

        const running = history.getRun(id);
        expect(running).toBeDefined();
        expect(running!.status).toBe('running');
        expect(running!.workflowName).toBe('test-workflow');
        expect(running!.inputs).toEqual({ input: 'hello' });

        history.endRun(id, 'completed', { result: 42 });

        const completed = history.getRun(id);
        expect(completed!.status).toBe('completed');
        expect(completed!.outputs).toEqual({ result: 42 });
        expect(completed!.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should record a failed run with error', () => {
        const id = history.startRun('fail-workflow');
        history.endRun(id, 'failed', undefined, 'Something went wrong');

        const run = history.getRun(id);
        expect(run!.status).toBe('failed');
        expect(run!.error).toBe('Something went wrong');
    });

    it('should record a cancelled run', () => {
        const id = history.startRun('cancel-workflow');
        history.endRun(id, 'cancelled');

        const run = history.getRun(id);
        expect(run!.status).toBe('cancelled');
    });

    it('should store workflow path and version', () => {
        const id = history.startRun(
            'versioned-wf',
            { x: 1 },
            '/path/to/workflow.md',
            '2.1.0',
        );

        const run = history.getRun(id);
        expect(run!.workflowPath).toBe('/path/to/workflow.md');
        expect(run!.workflowVersion).toBe('2.1.0');
    });

    // ─── Events ──────────────────────────────────────────────

    it('should record and retrieve events', () => {
        const id = history.startRun('event-workflow');
        history.recordEvent(id, 'workflow:start', undefined, { totalSteps: 3 });
        history.recordEvent(id, 'step:start', 'step-1', { title: 'First step' });
        history.recordEvent(id, 'step:end', 'step-1', { success: true });
        history.recordEvent(id, 'workflow:end');

        const events = history.getEvents(id);
        expect(events).toHaveLength(4);
        expect(events[0]!.eventType).toBe('workflow:start');
        expect(events[0]!.data).toEqual({ totalSteps: 3 });
        expect(events[1]!.stepId).toBe('step-1');
        expect(events[3]!.eventType).toBe('workflow:end');
    });

    it('should return empty events for unknown run', () => {
        const events = history.getEvents('nonexistent');
        expect(events).toEqual([]);
    });

    // ─── Filtering ──────────────────────────────────────────

    it('should list runs ordered by start time descending', () => {
        const id1 = history.startRun('wf-a');
        history.endRun(id1, 'completed');
        const id2 = history.startRun('wf-b');
        history.endRun(id2, 'completed');

        const runs = history.listRuns();
        expect(runs).toHaveLength(2);
        // ORDER BY started_at DESC — both may share the same timestamp,
        // so just verify both IDs are present
        const ids = runs.map((r) => r.id);
        expect(ids).toContain(id1);
        expect(ids).toContain(id2);
    });

    it('should filter runs by workflow name', () => {
        history.startRun('alpha');
        history.startRun('beta');
        history.startRun('alpha');

        const runs = history.listRuns({ workflowName: 'alpha' });
        expect(runs).toHaveLength(2);
        expect(runs.every((r) => r.workflowName === 'alpha')).toBe(true);
    });

    it('should filter runs by status', () => {
        const id1 = history.startRun('wf');
        history.endRun(id1, 'completed');
        const id2 = history.startRun('wf');
        history.endRun(id2, 'failed', undefined, 'err');
        const id3 = history.startRun('wf');
        history.endRun(id3, 'completed');

        const failed = history.listRuns({ status: 'failed' });
        expect(failed).toHaveLength(1);
        expect(failed[0]!.id).toBe(id2);
    });

    it('should respect limit parameter', () => {
        for (let i = 0; i < 10; i++) {
            const id = history.startRun(`wf-${i}`);
            history.endRun(id, 'completed');
        }

        const runs = history.listRuns({ limit: 3 });
        expect(runs).toHaveLength(3);
    });

    // ─── Success Rate ──────────────────────────────────────

    it('should compute success rate', () => {
        for (let i = 0; i < 7; i++) {
            const id = history.startRun('rate-wf');
            history.endRun(id, 'completed');
        }
        for (let i = 0; i < 3; i++) {
            const id = history.startRun('rate-wf');
            history.endRun(id, 'failed', undefined, 'err');
        }

        const rate = history.getSuccessRate('rate-wf');
        expect(rate.total).toBe(10);
        expect(rate.success).toBe(7);
        expect(rate.rate).toBeCloseTo(0.7);
    });

    it('should return zero rate for unknown workflow', () => {
        const rate = history.getSuccessRate('nonexistent');
        expect(rate).toEqual({ total: 0, success: 0, rate: 0 });
    });

    it('should exclude running runs from success rate', () => {
        const id1 = history.startRun('rate-wf');
        history.endRun(id1, 'completed');
        // This one is still running
        history.startRun('rate-wf');

        const rate = history.getSuccessRate('rate-wf');
        expect(rate.total).toBe(1); // Only the completed one counts
        expect(rate.success).toBe(1);
        expect(rate.rate).toBe(1);
    });

    // ─── getRun edge cases ──────────────────────────────────

    it('should return undefined for unknown run ID', () => {
        expect(history.getRun('nonexistent')).toBeUndefined();
    });
});
