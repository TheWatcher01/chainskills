/**
 * MCP Server adapter — exposes chainskills workflows as MCP tools,
 * resources, and prompts for Copilot and other MCP-compatible clients.
 *
 * Uses the `McpServer` high-level API with `registerTool`, `registerResource`,
 * and `registerPrompt` (non-deprecated API).
 *
 * @module adapters/tools/mcp-server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import type { Container } from '#config/container.js';
import {
    runWorkflow,
    describeWorkflow,
} from '#core/use-cases/run-workflow.js';
import { parseWorkflow } from '#core/use-cases/parse-workflow.js';
import { buildDAG } from '#core/use-cases/build-dag.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Recursively find all `.workflow.md` files in a directory. */
function findWorkflowFiles(
    dir: string,
    maxDepth: number = 3,
): string[] {
    const files: string[] = [];

    function walk(currentDir: string, depth: number): void {
        if (depth > maxDepth) return;
        let entries: string[];
        try {
            entries = readdirSync(currentDir);
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.startsWith('.') || entry === 'node_modules') continue;
            const fullPath = join(currentDir, entry);
            let stat;
            try {
                stat = statSync(fullPath);
            } catch {
                continue;
            }
            if (stat.isDirectory()) {
                walk(fullPath, depth + 1);
            } else if (entry.endsWith('.workflow.md')) {
                files.push(fullPath);
            }
        }
    }

    walk(dir, 0);
    return files.sort();
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** MCP server configuration. */
export interface McpServerConfig {
    /** Server name exposed via MCP. */
    readonly name: string;
    /** Server version. */
    readonly version: string;
    /** Base directory for workflow discovery. */
    readonly workflowsDir: string;
}

/**
 * Create a pre-configured MCP server with all chainskills tools,
 * resources, and prompts registered.
 *
 * @param container - Wired DI container.
 * @param config - MCP server configuration.
 * @returns A ready-to-connect `McpServer` instance.
 */
export function createMcpServer(
    container: Container,
    config: McpServerConfig,
): McpServer {
    const server = new McpServer(
        {
            name: config.name,
            version: config.version,
        },
        {
            capabilities: {
                tools: {},
                resources: {},
                prompts: {},
            },
        },
    );

    registerTools(server, container, config);
    registerResources(server, container, config);
    registerPrompts(server, container, config);

    return server;
}

// ─── Tools ───────────────────────────────────────────────────────────────────

function registerTools(
    server: McpServer,
    container: Container,
    _config: McpServerConfig,
): void {
    // ── chainskills_run ──────────────────────────────────────────────
    server.registerTool(
        'chainskills_run',
        {
            title: 'Run Workflow',
            description:
                'Execute a .workflow.md file and return the result. ' +
                'Provide the file path and optional input variables.',
            inputSchema: {
                path: z
                    .string()
                    .describe('Path to the .workflow.md file'),
                inputs: z
                    .record(z.string())
                    .optional()
                    .describe('Input variables as key-value pairs'),
                dryRun: z
                    .boolean()
                    .optional()
                    .default(false)
                    .describe(
                        'When true, simulate execution without side effects',
                    ),
            },
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false,
                openWorldHint: true,
            },
        },
        async ({ path, inputs, dryRun }) => {
            const result = await runWorkflow(
                resolve(path),
                container,
                { inputs, dryRun },
            );

            if (result.ok) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify(
                                {
                                    ok: true,
                                    workflow: result.value.workflow,
                                    duration: result.value.duration,
                                    steps: result.value.execution.steps,
                                    outputs: result.value.execution.outputs,
                                },
                                null,
                                2,
                            ),
                        },
                    ],
                };
            }

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: JSON.stringify(
                            {
                                ok: false,
                                error: result.error,
                            },
                            null,
                            2,
                        ),
                    },
                ],
                isError: true,
            };
        },
    );

    // ── chainskills_validate ─────────────────────────────────────────
    server.registerTool(
        'chainskills_validate',
        {
            title: 'Validate Workflow',
            description:
                'Parse and validate a .workflow.md file without executing it. ' +
                'Returns validation diagnostics.',
            inputSchema: {
                path: z
                    .string()
                    .describe('Path to the .workflow.md file'),
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ path }) => {
            const result = await describeWorkflow(resolve(path), container);

            if (result.ok) {
                const desc = result.value;
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify(
                                {
                                    valid: desc.validation.valid,
                                    workflow: {
                                        name: desc.name,
                                        version: desc.version,
                                        steps: desc.steps.length,
                                    },
                                    diagnostics: desc.validation.diagnostics,
                                },
                                null,
                                2,
                            ),
                        },
                    ],
                };
            }

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: JSON.stringify(
                            { valid: false, error: result.error },
                            null,
                            2,
                        ),
                    },
                ],
                isError: true,
            };
        },
    );

    // ── chainskills_describe ─────────────────────────────────────────
    server.registerTool(
        'chainskills_describe',
        {
            title: 'Describe Workflow',
            description:
                'Introspect a .workflow.md file — returns its structure, inputs, ' +
                'outputs, steps, DAG, and validation report without executing it.',
            inputSchema: {
                path: z
                    .string()
                    .describe('Path to the .workflow.md file'),
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ path }) => {
            const result = await describeWorkflow(resolve(path), container);

            if (result.ok) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify(result.value, null, 2),
                        },
                    ],
                };
            }

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: JSON.stringify(
                            { error: result.error },
                            null,
                            2,
                        ),
                    },
                ],
                isError: true,
            };
        },
    );

    // ── chainskills_list ─────────────────────────────────────────────
    server.registerTool(
        'chainskills_list',
        {
            title: 'List Workflows',
            description:
                'List all .workflow.md files found in the specified directory ' +
                'with their metadata (name, version, description, tags).',
            inputSchema: {
                dir: z
                    .string()
                    .optional()
                    .default('.')
                    .describe(
                        'Directory to search (default: current directory)',
                    ),
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ dir }) => {
            const searchDir = resolve(dir);
            const files = findWorkflowFiles(searchDir);

            const workflows: Array<{
                path: string;
                name: string;
                version: string;
                description: string;
                steps: number;
                tags: string[];
            }> = [];

            for (const file of files) {
                try {
                    const source = readFileSync(file, 'utf-8');
                    const parseResult = parseWorkflow(
                        source,
                        container.parser,
                    );
                    if (parseResult.ok) {
                        const wf = parseResult.value;
                        workflows.push({
                            path: relative(searchDir, file),
                            name: wf.name,
                            version: wf.version,
                            description: wf.description,
                            steps: wf.steps.length,
                            tags: [...wf.tags],
                        });
                    }
                } catch {
                    // Skip files that can't be parsed
                }
            }

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: JSON.stringify(workflows, null, 2),
                    },
                ],
            };
        },
    );

    // ── chainskills_inspect ──────────────────────────────────────────
    server.registerTool(
        'chainskills_inspect',
        {
            title: 'Inspect Workflow DAG',
            description:
                'Parse a .workflow.md file and return its DAG structure ' +
                '(directed acyclic graph of steps and dependencies).',
            inputSchema: {
                path: z
                    .string()
                    .describe('Path to the .workflow.md file'),
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ path }) => {
            const absPath = resolve(path);
            let source: string;
            try {
                source = readFileSync(absPath, 'utf-8');
            } catch (e) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `Cannot read file: ${path}`,
                        },
                    ],
                    isError: true,
                };
            }

            const parseResult = parseWorkflow(source, container.parser);
            if (!parseResult.ok) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify(
                                { error: parseResult.error },
                                null,
                                2,
                            ),
                        },
                    ],
                    isError: true,
                };
            }

            const dagResult = buildDAG(parseResult.value);
            if (!dagResult.ok) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify(
                                { error: dagResult.error },
                                null,
                                2,
                            ),
                        },
                    ],
                    isError: true,
                };
            }

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: JSON.stringify(
                            {
                                workflow: parseResult.value.name,
                                dag: dagResult.value,
                            },
                            null,
                            2,
                        ),
                    },
                ],
            };
        },
    );

    // ── chainskills_traces ──────────────────────────────────────────
    server.registerTool(
        'chainskills_traces',
        {
            title: 'Query Execution Traces',
            description:
                'Query recorded execution traces with optional filters. ' +
                'Returns traces from CRAG/KG or local JSONL store.',
            inputSchema: {
                workflow_name: z.string().optional().describe('Filter by workflow name'),
                status: z.enum(['ok', 'error', 'skip']).optional().describe('Filter by status'),
                run_id: z.string().optional().describe('Filter by run ID'),
                limit: z.number().optional().describe('Max results (default 20)'),
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ workflow_name, status, run_id, limit }) => {
            const traces = await container.traceStore.query({
                workflow_name: workflow_name ?? undefined,
                status: status ?? undefined,
                run_id: run_id ?? undefined,
                limit: limit ?? 20,
            });

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: JSON.stringify(
                            { count: traces.length, traces },
                            null,
                            2,
                        ),
                    },
                ],
            };
        },
    );

    // ── chainskills_trace_stats ─────────────────────────────────────
    server.registerTool(
        'chainskills_trace_stats',
        {
            title: 'Trace Statistics',
            description:
                'Get aggregate statistics about execution traces: ' +
                'total runs, by status, by directive, average duration.',
            inputSchema: {},
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async () => {
            const stats = await container.traceStore.stats();

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: JSON.stringify(stats, null, 2),
                    },
                ],
            };
        },
    );
}

// ─── Resources ───────────────────────────────────────────────────────────────

function registerResources(
    server: McpServer,
    _container: Container,
    config: McpServerConfig,
): void {
    const searchDir = resolve(config.workflowsDir);
    const files = findWorkflowFiles(searchDir);

    // Register each discovered workflow file as a static resource
    for (const file of files) {
        const relPath = relative(searchDir, file);
        const uri = `chainskills://workflow/${relPath}`;

        server.registerResource(
            relPath,
            uri,
            {
                description: `Workflow file: ${relPath}`,
                mimeType: 'text/markdown',
            },
            async () => {
                const content = readFileSync(file, 'utf-8');
                return {
                    contents: [
                        {
                            uri,
                            text: content,
                            mimeType: 'text/markdown',
                        },
                    ],
                };
            },
        );
    }
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

function registerPrompts(
    server: McpServer,
    _container: Container,
    _config: McpServerConfig,
): void {
    // ── create_workflow ──────────────────────────────────────────────
    server.registerPrompt(
        'create_workflow',
        {
            title: 'Create Workflow',
            description:
                'Generate a new .workflow.md file based on a description of what the workflow should do.',
            argsSchema: {
                description: z
                    .string()
                    .describe(
                        'What the workflow should accomplish',
                    ),
                name: z
                    .string()
                    .optional()
                    .describe(
                        'Workflow name (kebab-case). Auto-generated if omitted.',
                    ),
            },
        },
        async ({ description, name }) => {
            const workflowName =
                name ?? description.slice(0, 40).replace(/\s+/g, '-').toLowerCase();

            return {
                messages: [
                    {
                        role: 'user' as const,
                        content: {
                            type: 'text' as const,
                            text: [
                                `Create a chainskills workflow named "${workflowName}" that accomplishes the following:`,
                                '',
                                description,
                                '',
                                'Use the .workflow.md format with:',
                                '- YAML frontmatter (name, description, version, inputs, outputs, env, tags)',
                                '- Markdown sections as steps (## headings)',
                                '- Directives: @use, @call, @if/@else, @for, @repeat, @parallel, @try/@on-error, @assert, @output, @env, @agent, @handoff',
                                '- Variables: $variable_name for substitution',
                                '',
                                'Follow chainskills conventions:',
                                '- Each step has a clear heading',
                                '- Use @call shell.exec($command) for CLI commands',
                                '- Use @try/@on-error for error handling',
                                '- Declare all inputs/outputs in frontmatter',
                                '- Use @assert for validation checkpoints',
                            ].join('\n'),
                        },
                    },
                ],
            };
        },
    );

    // ── explain_workflow ─────────────────────────────────────────────
    server.registerPrompt(
        'explain_workflow',
        {
            title: 'Explain Workflow',
            description:
                'Analyze and explain a .workflow.md file — describe its purpose, steps, inputs, outputs, and flow.',
            argsSchema: {
                path: z
                    .string()
                    .describe('Path to the .workflow.md file to explain'),
            },
        },
        async ({ path }) => {
            let source: string;
            try {
                source = readFileSync(resolve(path), 'utf-8');
            } catch {
                return {
                    messages: [
                        {
                            role: 'user' as const,
                            content: {
                                type: 'text' as const,
                                text: `Cannot read workflow file: ${path}`,
                            },
                        },
                    ],
                };
            }

            return {
                messages: [
                    {
                        role: 'user' as const,
                        content: {
                            type: 'text' as const,
                            text: [
                                'Analyze and explain this chainskills workflow:',
                                '',
                                '```markdown',
                                source,
                                '```',
                                '',
                                'Please describe:',
                                '1. What this workflow does (purpose)',
                                '2. Its inputs and expected outputs',
                                '3. The step-by-step execution flow',
                                '4. Any branching, parallel execution, or error handling',
                                '5. Environment variables or tools required',
                                '6. Potential improvements or issues',
                            ].join('\n'),
                        },
                    },
                ],
            };
        },
    );
}
