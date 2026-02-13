/**
 * Tests for the MCP server adapter — tool registration, resource
 * listing, and prompt rendering.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createMcpServer } from '#adapters/tools/mcp-server.js';
import { createContainer } from '#config/container.js';
import type { Container } from '#config/container.js';

// ─── Setup ───────────────────────────────────────────────────────────────────

let container: Container;

beforeAll(async () => {
    container = await createContainer({
        executor: 'simple',
        logLevel: 'error',
        workflowsDir: './templates',
    });
});

// ─── Server Creation ─────────────────────────────────────────────────────────

describe('createMcpServer', () => {
    it('should create a McpServer instance', () => {
        const server = createMcpServer(container, {
            name: 'test-server',
            version: '1.0.0',
            workflowsDir: './templates',
        });

        expect(server).toBeDefined();
        expect(typeof server.connect).toBe('function');
        expect(typeof server.close).toBe('function');
    });

    it('should expose the underlying server property', () => {
        const server = createMcpServer(container, {
            name: 'test-server',
            version: '1.0.0',
            workflowsDir: './templates',
        });

        expect(server.server).toBeDefined();
    });
});

// ─── SDK API ─────────────────────────────────────────────────────────────────

describe('runWorkflow SDK', () => {
    it('should import runWorkflow and describeWorkflow', async () => {
        const mod = await import('#core/use-cases/run-workflow.js');
        expect(typeof mod.runWorkflow).toBe('function');
        expect(typeof mod.describeWorkflow).toBe('function');
    });

    it('should return error for non-existent file', async () => {
        const { runWorkflow } = await import(
            '#core/use-cases/run-workflow.js'
        );
        const result = await runWorkflow(
            '/tmp/nonexistent.workflow.md',
            container,
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.phase).toBe('read');
            expect(result.error.code).toBe('FILE_NOT_FOUND');
        }
    });

    it('should describe a valid workflow file', async () => {
        const { describeWorkflow } = await import(
            '#core/use-cases/run-workflow.js'
        );
        const result = await describeWorkflow(
            './templates/dev/code-review.workflow.md',
            container,
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.name).toBeTruthy();
            expect(result.value.version).toBeTruthy();
            expect(result.value.steps.length).toBeGreaterThan(0);
            expect(result.value.validation).toBeDefined();
        }
    });

    it('should return error for description of non-existent file', async () => {
        const { describeWorkflow } = await import(
            '#core/use-cases/run-workflow.js'
        );
        const result = await describeWorkflow(
            '/tmp/nonexistent.workflow.md',
            container,
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.phase).toBe('read');
        }
    });
});

// ─── Config ──────────────────────────────────────────────────────────────────

describe('MCP config fields', () => {
    it('should include MCP transport config', async () => {
        const { DEFAULT_CONFIG } = await import('#config/defaults.js');
        expect(DEFAULT_CONFIG.mcpTransport).toBe('stdio');
        expect(DEFAULT_CONFIG.mcpServerName).toBe('chainskills');
        expect(DEFAULT_CONFIG.mcpServerVersion).toBe('0.3.0');
        expect(DEFAULT_CONFIG.mcpPort).toBe(3001);
    });

    it('should validate MCP env vars', async () => {
        const { loadEnvConfig } = await import('#config/env.js');
        const config = loadEnvConfig();
        expect(config.mcpTransport).toBeDefined();
        expect(config.mcpServerName).toBeDefined();
        expect(config.mcpServerVersion).toBeDefined();
    });
});
