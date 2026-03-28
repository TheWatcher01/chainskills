/**
 * CLI command: `chainskills serve`
 *
 * Starts a Model Context Protocol (MCP) server exposing chainskills
 * workflows as tools, resources, and prompts for Copilot and other
 * MCP-compatible clients.
 *
 * @module cli/serve
 */

import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { createContainer } from '#config/container.js';
import { createMcpServer } from '#adapters/tools/mcp-server.js';

export const serveCommand = defineCommand({
    meta: {
        name: 'serve',
        description: 'Start an MCP server for AI agent integration',
    },
    args: {
        stdio: {
            type: 'boolean',
            description: 'Use stdio transport (default, for Copilot)',
            default: true,
        },
        port: {
            type: 'string',
            description: 'Use streamable HTTP transport on this port (overrides --stdio)',
            required: false,
        },
        dir: {
            type: 'string',
            description: 'Workflows directory to expose',
            required: false,
        },
        name: {
            type: 'string',
            description: 'Server name',
            default: 'chainskills',
        },
    },
    async run({ args }) {
        const container = await createContainer();
        const workflowsDir = resolve(args.dir ?? container.config.workflowsDir);

        const mcpServer = createMcpServer(container, {
            name: args.name ?? 'chainskills',
            version: container.config.mcpServerVersion,
            workflowsDir,
        });

        // ── Streamable HTTP transport ────────────────────────────────
        if (args.port) {
            const port = parseInt(args.port, 10);
            if (isNaN(port) || port <= 0 || port > 65535) {
                console.error(pc.red('Error: Invalid port number'));
                process.exit(1);
            }

            const { StreamableHTTPServerTransport } = await import(
                '@modelcontextprotocol/sdk/server/streamableHttp.js'
            );
            const { createServer } = await import('node:http');

            const httpTransport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
            });

            const httpServer = createServer(async (req, res) => {
                // Only handle /mcp endpoint
                if (req.url === '/mcp' || req.url === '/mcp/') {
                    await httpTransport.handleRequest(req, res);
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Not found. Use /mcp endpoint.' }));
                }
            });

            await mcpServer.connect(httpTransport);

            httpServer.listen(port, () => {
                console.error(
                    pc.green(`⟫ chainskills MCP server listening on `) +
                    pc.bold(`http://localhost:${port}/mcp`) +
                    pc.dim(` (streamable HTTP)`),
                );
                console.error(pc.dim(`  Workflows dir: ${workflowsDir}`));
            });

            // Graceful shutdown
            const shutdown = async () => {
                console.error(pc.dim('\nShutting down...'));
                await mcpServer.close();
                httpServer.close();
                process.exit(0);
            };
            process.on('SIGINT', shutdown);
            process.on('SIGTERM', shutdown);

            return;
        }

        // ── Stdio transport (default — for Copilot) ──────────────────
        const { StdioServerTransport } = await import(
            '@modelcontextprotocol/sdk/server/stdio.js'
        );

        const transport = new StdioServerTransport();
        await mcpServer.connect(transport);

        // Log to stderr only (stdout is reserved for MCP protocol)
        console.error(
            pc.green(`⟫ chainskills MCP server started`) +
            pc.dim(` (stdio transport)`),
        );
        console.error(pc.dim(`  Workflows dir: ${workflowsDir}`));
    },
});
