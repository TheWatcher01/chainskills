/**
 * Tests for the MCP client tool provider and composite tool provider.
 */

import { describe, it, expect } from 'vitest';
import { createCompositeToolProvider } from '#adapters/tools/composite-tool-provider.js';
import { isOk, isErr } from '#infra/errors.js';
import type { ToolProvider } from '#core/ports/tool-provider.port.js';
import type { Result } from '#infra/errors.js';
import type { ToolError } from '#infra/errors.js';
import { ok, err, toolError } from '#infra/errors.js';

// ─── Mock Providers ──────────────────────────────────────────────────────────

function createMockProvider(
    namespace: string,
    tools: Record<string, unknown>,
): ToolProvider {
    return {
        async call(
            tool: string,
            method: string,
            _args: Record<string, unknown>,
        ): Promise<Result<unknown, ToolError>> {
            if (tool !== namespace) {
                return err(toolError('WRONG_NS', `Wrong namespace: ${tool}`, tool, method));
            }
            if (method in tools) {
                return ok(tools[method]);
            }
            return err(toolError('NOT_FOUND', `Tool ${method} not found`, tool, method));
        },
        has(tool: string, method: string): boolean {
            return tool === namespace && method in tools;
        },
    };
}

// ─── Composite Tool Provider ─────────────────────────────────────────────────

describe('createCompositeToolProvider', () => {
    const shell = createMockProvider('shell', { exec: 'hello world' });
    const mcp = createMockProvider('mcp', { search: 'results here' });
    const composite = createCompositeToolProvider({ shell, mcp });

    it('should route shell.* calls to shell provider', async () => {
        const result = await composite.call('shell', 'exec', { command: 'echo hello' });
        expect(isOk(result)).toBe(true);
        if (result.ok) {
            expect(result.value).toBe('hello world');
        }
    });

    it('should route mcp.* calls to mcp provider', async () => {
        const result = await composite.call('mcp', 'search', { query: 'test' });
        expect(isOk(result)).toBe(true);
        if (result.ok) {
            expect(result.value).toBe('results here');
        }
    });

    it('should return error for unknown namespace', async () => {
        const result = await composite.call('unknown', 'method', {});
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.code).toBe('TOOL_NOT_FOUND');
            expect(result.error.message).toContain('unknown');
        }
    });

    it('should check has() for shell tools', () => {
        expect(composite.has('shell', 'exec')).toBe(true);
        expect(composite.has('shell', 'missing')).toBe(false);
    });

    it('should check has() for mcp tools', () => {
        expect(composite.has('mcp', 'search')).toBe(true);
        expect(composite.has('mcp', 'missing')).toBe(false);
    });

    it('should return false for has() on unknown namespace', () => {
        expect(composite.has('unknown', 'anything')).toBe(false);
    });

    it('should propagate errors from underlying provider', async () => {
        const result = await composite.call('mcp', 'nonexistent', {});
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.code).toBe('NOT_FOUND');
        }
    });
});

// ─── MCP Client Provider (unit) ──────────────────────────────────────────────

describe('createMcpClientProvider', () => {
    it('should be importable', async () => {
        const mod = await import('#adapters/tools/mcp-client.js');
        expect(typeof mod.createMcpClientProvider).toBe('function');
    });

    it('should reject non-mcp tool namespace', async () => {
        const { createMcpClientProvider } = await import(
            '#adapters/tools/mcp-client.js'
        );
        const provider = createMcpClientProvider({ servers: {} });
        const result = await provider.call('shell', 'exec', {});
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.code).toBe('TOOL_NAMESPACE');
        }
    });

    it('should return MCP_TOOL_NOT_FOUND when no servers configured', async () => {
        const { createMcpClientProvider } = await import(
            '#adapters/tools/mcp-client.js'
        );
        const provider = createMcpClientProvider({ servers: {} });
        const result = await provider.call('mcp', 'some_tool', {});
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.code).toBe('MCP_TOOL_NOT_FOUND');
        }
    });

    it('should optimistically report has() as true when not connected', async () => {
        const { createMcpClientProvider } = await import('#adapters/tools/mcp-client.js');
        const provider = createMcpClientProvider({ servers: {} });
        // No servers = size 0 → optimistically true
        expect(provider.has('mcp', 'anything')).toBe(true);
    });

    it('should return false for has() on non-mcp namespace', async () => {
        const { createMcpClientProvider } = await import('#adapters/tools/mcp-client.js');
        const provider = createMcpClientProvider({ servers: {} });
        expect(provider.has('shell', 'exec')).toBe(false);
    });

    it('should expose close() method', async () => {
        const { createMcpClientProvider } = await import(
            '#adapters/tools/mcp-client.js'
        );
        const provider = createMcpClientProvider({ servers: {} });
        expect(typeof provider.close).toBe('function');
        // Should not throw when no connections
        await provider.close();
    });
});

// ─── Container Integration ───────────────────────────────────────────────────

describe('composite tools in container', () => {
    it('should use composite provider in container', async () => {
        const { createContainer } = await import('#config/container.js');
        const container = await createContainer({
            executor: 'simple',
            logLevel: 'error',
        });

        // Container tools should be a composite that includes shell
        expect(container.tools).toBeDefined();
        expect(container.tools.has('shell', 'exec')).toBe(true);
    });

    it('should export MCP client types from public API', async () => {
        const mod = await import('../../src/index.js');
        expect(typeof mod.createMcpClientProvider).toBe('function');
        expect(typeof mod.createCompositeToolProvider).toBe('function');
    });
});
