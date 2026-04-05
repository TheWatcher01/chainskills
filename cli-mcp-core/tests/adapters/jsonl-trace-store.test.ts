/**
 * Tests for JSONL TraceStore adapter — local file persistence.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createJsonlTraceStore } from '#adapters/trace-store/jsonl-trace-store.js';
import type { ExecutionTrace } from '#core/entities/execution-trace.js';

function makeTrace(overrides: Partial<ExecutionTrace> = {}): ExecutionTrace {
    return {
        run_id: 'run-001',
        workflow_name: 'test-workflow',
        step_id: 'step-1',
        directive_type: 'call',
        timestamp: new Date().toISOString(),
        duration_ms: 42,
        status: 'ok',
        input: '@call shell.exec(echo hello)',
        output: 'hello',
        ...overrides,
    };
}

describe('JsonlTraceStore', () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'chainskills-trace-test-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('should create directory and write traces on flush', async () => {
        const dir = join(tmpDir, 'traces');
        const store = createJsonlTraceStore({ directory: dir });

        store.append(makeTrace());
        store.append(makeTrace({ step_id: 'step-2', directive_type: 'assert' }));
        await store.flush();

        const files = await readdir(dir);
        expect(files).toHaveLength(1);
        expect(files[0]).toBe('run-001.jsonl');

        const content = await readFile(join(dir, files[0]!), 'utf-8');
        const lines = content.trim().split('\n');
        expect(lines).toHaveLength(2);
    });

    it('should separate traces by run_id into different files', async () => {
        const store = createJsonlTraceStore({ directory: tmpDir });

        store.append(makeTrace({ run_id: 'run-A' }));
        store.append(makeTrace({ run_id: 'run-B' }));
        await store.flush();

        const files = await readdir(tmpDir);
        expect(files.sort()).toEqual(['run-A.jsonl', 'run-B.jsonl']);
    });

    it('should query all traces', async () => {
        const store = createJsonlTraceStore({ directory: tmpDir });

        store.append(makeTrace({ step_id: 's1' }));
        store.append(makeTrace({ step_id: 's2' }));
        await store.flush();

        const traces = await store.query();
        expect(traces).toHaveLength(2);
    });

    it('should filter traces by run_id', async () => {
        const store = createJsonlTraceStore({ directory: tmpDir });

        store.append(makeTrace({ run_id: 'run-A' }));
        store.append(makeTrace({ run_id: 'run-B' }));
        await store.flush();

        const traces = await store.query({ run_id: 'run-A' });
        expect(traces).toHaveLength(1);
        expect(traces[0]!.run_id).toBe('run-A');
    });

    it('should filter traces by status', async () => {
        const store = createJsonlTraceStore({ directory: tmpDir });

        store.append(makeTrace({ status: 'ok' }));
        store.append(makeTrace({ status: 'error', step_id: 's2' }));
        await store.flush();

        const errors = await store.query({ status: 'error' });
        expect(errors).toHaveLength(1);
        expect(errors[0]!.status).toBe('error');
    });

    it('should filter traces by workflow_name', async () => {
        const store = createJsonlTraceStore({ directory: tmpDir });

        store.append(makeTrace({ workflow_name: 'wf-A' }));
        store.append(makeTrace({ workflow_name: 'wf-B', step_id: 's2' }));
        await store.flush();

        const traces = await store.query({ workflow_name: 'wf-A' });
        expect(traces).toHaveLength(1);
    });

    it('should respect limit parameter', async () => {
        const store = createJsonlTraceStore({ directory: tmpDir });

        for (let i = 0; i < 10; i++) {
            store.append(makeTrace({ step_id: `s-${i}` }));
        }
        await store.flush();

        const traces = await store.query({ limit: 3 });
        expect(traces).toHaveLength(3);
    });

    it('should count traces', async () => {
        const store = createJsonlTraceStore({ directory: tmpDir });

        store.append(makeTrace({ step_id: 's1' }));
        store.append(makeTrace({ step_id: 's2' }));
        store.append(makeTrace({ step_id: 's3' }));
        await store.flush();

        const count = await store.count();
        expect(count).toBe(3);
    });

    it('should compute stats', async () => {
        const store = createJsonlTraceStore({ directory: tmpDir });

        store.append(makeTrace({ status: 'ok', duration_ms: 100, directive_type: 'call' }));
        store.append(makeTrace({ status: 'ok', duration_ms: 200, directive_type: 'agent', step_id: 's2' }));
        store.append(makeTrace({ status: 'error', duration_ms: 50, directive_type: 'call', step_id: 's3' }));
        await store.flush();

        const stats = await store.stats();
        expect(stats.total_traces).toBe(3);
        expect(stats.total_runs).toBe(1);
        expect(stats.unique_workflows).toBe(1);
        expect(stats.by_status['ok']).toBe(2);
        expect(stats.by_status['error']).toBe(1);
        expect(stats.by_directive['call']).toBe(2);
        expect(stats.by_directive['agent']).toBe(1);
        expect(stats.avg_duration_ms).toBeCloseTo(116.67, 0);
    });

    it('should return empty results for nonexistent directory', async () => {
        const store = createJsonlTraceStore({ directory: '/tmp/nonexistent-chainskills-dir' });
        const traces = await store.query();
        expect(traces).toEqual([]);
    });

    it('should not write anything if buffer is empty on flush', async () => {
        const store = createJsonlTraceStore({ directory: tmpDir });
        await store.flush();

        const files = await readdir(tmpDir);
        // tmpDir exists but no .jsonl files created
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
        expect(jsonlFiles).toHaveLength(0);
    });
});
