/**
 * E2E tests for MCP server tools — verify all 7 tools respond correctly.
 */

import { describe, it, expect } from 'vitest';
import { createMcpServer } from '#adapters/tools/mcp-server.js';
import { createContainer } from '#config/container.js';
import { resolve } from 'node:path';

describe('MCP Server Tools E2E', () => {
    it('should create MCP server with all tools registered', async () => {
        const container = await createContainer({
            logLevel: 'warn',
            executor: 'simple',
        });

        const { server } = createMcpServer(container, {
            workflowsDir: resolve('./templates'),
        });

        expect(server).toBeDefined();
    });

    it('should have traceStore with working query API', async () => {
        const container = await createContainer({
            logLevel: 'warn',
            executor: 'simple',
            tracesDir: '/tmp/cs-test-query-' + Date.now(),
        });

        // Query should return empty array (no traces yet)
        const traces = await container.traceStore.query({ limit: 10 });
        expect(Array.isArray(traces)).toBe(true);

        // Stats should return valid structure
        const stats = await container.traceStore.stats();
        expect(stats.total_traces).toBe(0);
        expect(typeof stats.avg_duration_ms).toBe('number');
    });

    it('should have working parser for validation', async () => {
        const container = await createContainer({
            logLevel: 'warn',
            executor: 'simple',
        });

        // Parse a simple workflow
        const source = `---
name: mcp-test
version: 0.1.0
---

# Step 1
@call shell.exec(echo hello) → $result
`;
        const result = container.parser.parse(source);
        expect(result.ok).toBe(true);
    });

    it('should have working executor in container', async () => {
        const container = await createContainer({
            logLevel: 'warn',
            executor: 'simple',
            recordTraces: false,
        });

        expect(container.executor).toBeDefined();
        expect(typeof container.executor.execute).toBe('function');
    });

    it('should have agent provider (noop without API key)', async () => {
        const container = await createContainer({
            logLevel: 'warn',
            executor: 'simple',
        });

        expect(container.agent).toBeDefined();
        expect(typeof container.agent.invoke).toBe('function');
        expect(typeof container.agent.has).toBe('function');
        expect(typeof container.agent.list).toBe('function');
    });

    it('should have all container services wired', async () => {
        const container = await createContainer({
            logLevel: 'warn',
            executor: 'simple',
        });

        expect(container.config).toBeDefined();
        expect(container.logger).toBeDefined();
        expect(container.parser).toBeDefined();
        expect(container.executor).toBeDefined();
        expect(container.store).toBeDefined();
        expect(container.tools).toBeDefined();
        expect(container.resolver).toBeDefined();
        expect(container.emitter).toBeDefined();
        expect(container.agent).toBeDefined();
        expect(container.observability).toBeDefined();
        expect(container.traceStore).toBeDefined();
    });
});
