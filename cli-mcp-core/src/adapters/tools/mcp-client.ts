/**
 * MCP client tool provider adapter.
 *
 * Implements the `ToolProvider` port for calling tools on external MCP servers.
 * Used when workflows reference `@call mcp.tool_name(args)`.
 *
 * Connects to external MCP servers via stdio transport (spawns a subprocess)
 * and delegates `callTool` requests through the MCP protocol.
 *
 * @module adapters/tools/mcp-client
 */

import type { Result } from '#infra/errors.js';
import type { ToolError } from '#infra/errors.js';
import { ok, err, toolError } from '#infra/errors.js';
import type { ToolProvider } from '#core/ports/tool-provider.port.js';
import type { Logger } from '#infra/logger.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** MCP server connection configuration. */
export interface McpServerEntry {
    /** Command to spawn the MCP server. */
    readonly command: string;
    /** Arguments for the server command. */
    readonly args?: readonly string[];
    /** Environment variables for the server process. */
    readonly env?: Readonly<Record<string, string>>;
    /** Working directory for the server process. */
    readonly cwd?: string;
}

/** Configuration for the MCP client tool provider. */
export interface McpClientConfig {
    /** Named MCP server configurations. */
    readonly servers: Readonly<Record<string, McpServerEntry>>;
    /** Request timeout in ms. Default: 30000. */
    readonly timeout?: number;
}

/** Internal representation of a connected MCP client. */
interface ConnectedClient {
    /** The MCP SDK Client instance. */
    client: InstanceType<typeof import('@modelcontextprotocol/sdk/client/index.js').Client>;
    /** The stdio transport. */
    transport: InstanceType<typeof import('@modelcontextprotocol/sdk/client/stdio.js').StdioClientTransport>;
    /** Set of available tool names (cached after `listTools()`). */
    tools: Set<string>;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create an MCP client tool provider.
 *
 * Tools are namespaced as `mcp.<tool_name>`. When a tool is called,
 * the provider lazily connects to the configured MCP server(s), lists
 * available tools, and routes the call via the MCP protocol.
 *
 * Usage in workflows:
 * ```markdown
 * @call mcp.search_files(query) → $results
 * ```
 *
 * @param config - MCP server configurations.
 * @param logger - Optional logger for debug output.
 * @returns A `ToolProvider` scoped to MCP tool calls.
 */
export function createMcpClientProvider(
    config: McpClientConfig,
    logger?: Logger,
): ToolProvider & { close: () => Promise<void> } {
    const clients = new Map<string, ConnectedClient>();
    const timeout = config.timeout ?? 30_000;

    /**
     * Lazily connect to all configured MCP servers and cache tool lists.
     */
    async function ensureConnected(): Promise<void> {
        if (clients.size > 0) return;

        // Dynamic import to avoid bundling @modelcontextprotocol/sdk in the core
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        const { StdioClientTransport } = await import(
            '@modelcontextprotocol/sdk/client/stdio.js'
        );

        for (const [serverName, entry] of Object.entries(config.servers)) {
            try {
                logger?.debug(`MCP client: connecting to "${serverName}"`, {
                    command: entry.command,
                    args: entry.args,
                });

                const transport = new StdioClientTransport({
                    command: entry.command,
                    args: entry.args ? [...entry.args] : [],
                    env: entry.env ? { ...entry.env } : undefined,
                    cwd: entry.cwd,
                });

                const client = new Client(
                    { name: 'chainskills', version: '0.3.0' },
                    { capabilities: {} },
                );

                await client.connect(transport);

                // Discover available tools
                const toolsResult = await client.listTools();
                const toolNames = new Set(
                    toolsResult.tools.map((t: { name: string }) => t.name),
                );

                clients.set(serverName, { client, transport, tools: toolNames });

                logger?.info(
                    `MCP client: connected to "${serverName}" — ${toolNames.size} tools available`,
                    { tools: [...toolNames] },
                );
            } catch (e) {
                logger?.warn(
                    `MCP client: failed to connect to "${serverName}": ${e instanceof Error ? e.message : String(e)}`,
                );
            }
        }
    }

    /**
     * Find which connected server provides a given tool name.
     */
    function findToolServer(
        toolName: string,
    ): ConnectedClient | undefined {
        for (const connected of clients.values()) {
            if (connected.tools.has(toolName)) {
                return connected;
            }
        }
        return undefined;
    }

    return {
        async call(
            tool: string,
            method: string,
            args: Record<string, unknown>,
        ): Promise<Result<unknown, ToolError>> {
            // Only handle mcp.* calls
            if (tool !== 'mcp') {
                return err(
                    toolError(
                        'TOOL_NAMESPACE',
                        `MCP client only handles tool="mcp", got "${tool}"`,
                        tool,
                        method,
                    ),
                );
            }

            try {
                await ensureConnected();
            } catch (e) {
                return err(
                    toolError(
                        'MCP_CONNECTION_ERROR',
                        `MCP client connection failed: ${e instanceof Error ? e.message : String(e)}`,
                        tool,
                        method,
                    ),
                );
            }

            const server = findToolServer(method);
            if (!server) {
                return err(
                    toolError(
                        'MCP_TOOL_NOT_FOUND',
                        `MCP tool "${method}" not found in any connected server`,
                        tool,
                        method,
                    ),
                );
            }

            try {
                logger?.debug(`MCP client: calling tool "${method}"`, {
                    args,
                });

                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(),
                    timeout,
                );

                const result = await server.client.callTool(
                    {
                        name: method,
                        arguments: args,
                    },
                    undefined,
                    { signal: controller.signal },
                );

                clearTimeout(timeoutId);

                // Cast content to array for type-safe extraction
                const content = Array.isArray(result.content)
                    ? (result.content as Array<{ type: string; text?: string }>)
                    : [];

                // Extract text content from MCP response
                if (result.isError) {
                    const errorText =
                        content
                            .filter((c) => c.type === 'text')
                            .map((c) => c.text ?? '')
                            .join('\n') || 'Unknown MCP tool error';

                    return err(
                        toolError(`MCP_TOOL_ERROR`, `MCP tool "${method}" error: ${errorText}`, tool, method),
                    );
                }

                // Prefer structuredContent if available
                if (result.structuredContent) {
                    return ok(result.structuredContent);
                }

                // Otherwise extract text content
                const textContent = content
                    .filter((c) => c.type === 'text')
                    .map((c) => c.text ?? '')
                    .join('\n');

                return ok(textContent || '');
            } catch (e) {
                if (e instanceof Error && e.name === 'AbortError') {
                    return err(
                        toolError(
                            'MCP_TIMEOUT',
                            `MCP tool "${method}" timed out after ${timeout}ms`,
                            tool,
                            method,
                        ),
                    );
                }

                return err(
                    toolError(
                        'MCP_CALL_ERROR',
                        `MCP tool "${method}" failed: ${e instanceof Error ? e.message : String(e)}`,
                        tool,
                        method,
                    ),
                );
            }
        },

        has(tool: string, method: string): boolean {
            if (tool !== 'mcp') return false;
            // If not connected yet, optimistically return true
            // (will fail safely at call time if tool doesn't exist)
            if (clients.size === 0) return true;
            return findToolServer(method) !== undefined;
        },

        /**
         * Close all MCP client connections gracefully.
         */
        async close(): Promise<void> {
            for (const [name, connected] of clients) {
                try {
                    await connected.client.close();
                    logger?.debug(`MCP client: disconnected from "${name}"`);
                } catch {
                    // best-effort cleanup
                }
            }
            clients.clear();
        },
    };
}
