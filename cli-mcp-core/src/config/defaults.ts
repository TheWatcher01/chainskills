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
    /** MCP server port. */
    readonly mcpPort: number;
    /** Registry URL. */
    readonly registryUrl: string;
    /** Shell command timeout (ms). */
    readonly shellTimeout: number;
}

/** Default config for local development. */
export const DEFAULT_CONFIG: AppConfig = {
    logLevel: 'debug',
    stateBackend: 'memory',
    executor: 'mastra',
    workflowsDir: './workflows',
    globalDir: '~/.chainskills',
    mcpPort: 3001,
    registryUrl: 'https://registry.chainskills.dev',
    shellTimeout: 30_000,
};
