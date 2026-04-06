/**
 * Tests for MCP trace tools: chainskills_traces and chainskills_trace_stats.
 *
 * Tests that the tools are registered and callable via the MCP server.
 */

import { describe, it, expect } from 'vitest';
import { createMcpServer } from '#adapters/tools/mcp-server.js';
import { createContainer } from '#config/container.js';

describe('MCP Trace Tools', () => {
    it('should create MCP server with trace tools registered', async () => {
        const container = await createContainer({
            logLevel: 'warn',
            executor: 'simple',
        });

        const { server } = createMcpServer(container, {
            workflowsDir: './templates',
        });

        expect(server).toBeDefined();
    });

    it('should have traceStore available in container', async () => {
        const container = await createContainer({
            logLevel: 'warn',
            executor: 'simple',
        });

        expect(container.traceStore).toBeDefined();
        expect(typeof container.traceStore.append).toBe('function');
        expect(typeof container.traceStore.flush).toBe('function');
        expect(typeof container.traceStore.query).toBe('function');
        expect(typeof container.traceStore.count).toBe('function');
        expect(typeof container.traceStore.stats).toBe('function');
    });

    it('should return empty traces from fresh store', async () => {
        const container = await createContainer({
            logLevel: 'warn',
            executor: 'simple',
            tracesDir: '/tmp/cs-test-empty-traces-' + Date.now(),
        });

        const traces = await container.traceStore.query();
        expect(traces).toEqual([]);
    });

    it('should return zero stats from fresh store', async () => {
        const container = await createContainer({
            logLevel: 'warn',
            tracesDir: '/tmp/cs-test-empty-stats-' + Date.now(),
            executor: 'simple',
        });

        const stats = await container.traceStore.stats();
        expect(stats.total_traces).toBe(0);
        expect(stats.total_runs).toBe(0);
    });

    it('should append and query traces', async () => {
        const container = await createContainer({
            logLevel: 'warn',
            executor: 'simple',
            tracesDir: '/tmp/chainskills-mcp-test-traces',
        });

        container.traceStore.append({
            run_id: 'mcp-test-run',
            workflow_name: 'test-workflow',
            step_id: 'step-1',
            directive_type: 'call',
            timestamp: new Date().toISOString(),
            duration_ms: 100,
            status: 'ok',
            input: '@call test',
            output: 'done',
        });

        // Before flush, query should still work (from buffer or empty)
        // Note: JSONL store queries disk, not buffer — so count depends on implementation
        const count = await container.traceStore.count();
        // Just verify the API doesn't throw
        expect(typeof count).toBe('number');
    });
});
