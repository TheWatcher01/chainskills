/**
 * Default configuration values for development.
 *
 * These are safe defaults for local development — never used as-is in production.
 *
 * @module config/defaults
 */

import type { LogLevel } from '#infra/logger.js';

/** Supported executor backends. */
export type ExecutorBackend = 'simple' | 'mastra';

/** Supported MCP transports. */
export type McpTransport = 'stdio' | 'http';

/** Application configuration shape. */
export interface AppConfig {
    /** Log level. */
    readonly logLevel: LogLevel;
    /** State backend. */
    readonly stateBackend: 'memory' | 'sqlite' | 'redis';
    /** Executor backend — 'simple' for sequential, 'mastra' for DAG orchestration. */
    readonly executor: ExecutorBackend;
    /** Local workflows directory. */
    readonly workflowsDir: string;
    /** Global chainskills directory. */
    readonly globalDir: string;
    /** MCP server port (used for HTTP transport). */
    readonly mcpPort: number;
    /** MCP transport type — 'stdio' for Copilot, 'http' for web clients. */
    readonly mcpTransport: McpTransport;
    /** MCP server name exposed to clients. */
    readonly mcpServerName: string;
    /** MCP server version exposed to clients. */
    readonly mcpServerVersion: string;
    /** Registry URL. */
    readonly registryUrl: string;
    /** Shell command timeout (ms). */
    readonly shellTimeout: number;
    /** Traces directory for JSONL fallback. */
    readonly tracesDir: string;
    /** Enable trace recording by default. */
    readonly recordTraces: boolean;
    /** Enable trace-informed agent feedback loop. */
    readonly agentFeedbackEnabled: boolean;
    /** Minimum confidence for feedback examples. */
    readonly agentFeedbackMinConfidence: number;
}

/** Default config for local development. */
export const DEFAULT_CONFIG: AppConfig = {
    logLevel: 'debug',
    stateBackend: 'memory',
    executor: 'mastra',
    workflowsDir: './workflows',
    globalDir: '~/.chainskills',
    mcpPort: 3001,
    mcpTransport: 'stdio',
    mcpServerName: 'chainskills',
    mcpServerVersion: '0.6.0',
    registryUrl: 'https://registry.chainskills.dev',
    shellTimeout: 30_000,
    tracesDir: './traces',
    recordTraces: true,
    agentFeedbackEnabled: false,
    agentFeedbackMinConfidence: 0.8,
};
