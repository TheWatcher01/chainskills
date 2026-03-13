/**
 * Tests for Replay — event timeline reconstruction and filtering.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSqlitePersistence } from '#adapters/state/sqlite-persistence.js';
import { createSqliteRunHistory } from '#adapters/state/sqlite-run-history.js';
import type { RunHistory } from '#core/ports/run-history.port.js';
import type { PersistenceStore } from '#core/ports/persistence.port.js';

/** Helper: create a run with a full event timeline. */
function createSampleRun(history: RunHistory) {
    const id = history.startRun('review-workflow', { target: 'src/' }, undefined, '1.0.0');
    history.recordEvent(id, 'workflow:start', undefined, { totalSteps: 3, dryRun: false });
    history.recordEvent(id, 'step:start', 'gather', { stepTitle: 'Gather files' });
    history.recordEvent(id, 'step:end', 'gather', { success: true, duration: 120 });
    history.recordEvent(id, 'step:start', 'analyze', { stepTitle: 'Analyze code' });
    history.recordEvent(id, 'step:end', 'analyze', { success: true, duration: 450 });
    history.recordEvent(id, 'step:start', 'report', { stepTitle: 'Generate report' });
    history.recordEvent(id, 'step:end', 'report', { success: true, duration: 80 });
    history.recordEvent(id, 'workflow:end', undefined, { success: true, duration: 650 });
    history.endRun(id, 'completed', { summary: 'All good', score: 0.95 });
    return id;
}

describe('Replay', () => {
    let persistence: PersistenceStore;
    let history: RunHistory;

    beforeEach(() => {
        persistence = createSqlitePersistence(':memory:');
        history = createSqliteRunHistory(persistence);
    });

    it('should retrieve full event timeline for a run', () => {
        const id = createSampleRun(history);
        const events = history.getEvents(id);

        expect(events.length).toBe(8);
        expect(events[0]!.eventType).toBe('workflow:start');
        expect(events[events.length - 1]!.eventType).toBe('workflow:end');
    });

    it('should support filtering events from a specific step', () => {
        const id = createSampleRun(history);
        const events = history.getEvents(id);

        // Simulate --from analyze: skip events before step "analyze"
        let startedShowing = false;
        const filtered = events.filter((e) => {
            if (e.stepId === 'analyze') startedShowing = true;
            return startedShowing;
        });

        expect(filtered.length).toBe(5); // analyze start, analyze end, report start, report end, workflow:end
        expect(filtered[0]!.stepId).toBe('analyze');
    });

    it('should reconstruct run with inputs and outputs', () => {
        const id = createSampleRun(history);
        const run = history.getRun(id);

        expect(run).toBeDefined();
        expect(run!.inputs).toEqual({ target: 'src/' });
        expect(run!.outputs).toEqual({ summary: 'All good', score: 0.95 });
        expect(run!.workflowVersion).toBe('1.0.0');
    });

    it('should handle replay of a failed run', () => {
        const id = history.startRun('fail-wf', { x: 1 });
        history.recordEvent(id, 'workflow:start');
        history.recordEvent(id, 'step:start', 'step-1');
        history.recordEvent(id, 'error', 'step-1', { message: 'Tool not found' });
        history.recordEvent(id, 'step:end', 'step-1', { success: false });
        history.recordEvent(id, 'workflow:end', undefined, { success: false });
        history.endRun(id, 'failed', undefined, 'Step "step-1" failed: Tool not found');

        const run = history.getRun(id);
        expect(run!.status).toBe('failed');
        expect(run!.error).toContain('Tool not found');

        const events = history.getEvents(id);
        const errorEvent = events.find((e) => e.eventType === 'error');
        expect(errorEvent).toBeDefined();
        expect(errorEvent!.data).toEqual({ message: 'Tool not found' });
    });

    it('should support output diff by providing original outputs', () => {
        const id = createSampleRun(history);
        const run = history.getRun(id);

        // The --diff flag shows original outputs — verify they exist
        expect(run!.outputs).toBeDefined();
        expect(run!.outputs!['summary']).toBe('All good');
        expect(run!.outputs!['score']).toBe(0.95);
    });

    it('should handle multiple runs of the same workflow for comparison', () => {
        // Run 1 — success
        const id1 = history.startRun('compare-wf', { x: 1 });
        history.endRun(id1, 'completed', { result: 'v1' });

        // Run 2 — failure
        const id2 = history.startRun('compare-wf', { x: 2 });
        history.endRun(id2, 'failed', undefined, 'bad input');

        // Run 3 — success
        const id3 = history.startRun('compare-wf', { x: 3 });
        history.endRun(id3, 'completed', { result: 'v3' });

        const rate = history.getSuccessRate('compare-wf');
        expect(rate.total).toBe(3);
        expect(rate.success).toBe(2);
        expect(rate.rate).toBeCloseTo(0.667, 2);

        // Filter only failed
        const failed = history.listRuns({ workflowName: 'compare-wf', status: 'failed' });
        expect(failed).toHaveLength(1);
        expect(failed[0]!.id).toBe(id2);
    });
});
