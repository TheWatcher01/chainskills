/**
 * Environment variable loader and validator.
 *
 * Implements Twelve-Factor App Factor III: config in the environment.
 * Validates presence and types of all variables at startup (fail-fast).
 *
 * @module config/env
 */

import { z } from 'zod';
import { DEFAULT_CONFIG, type AppConfig } from './defaults.js';

/** Zod schema for environment variable validation. */
const EnvSchema = z.object({
    CHAINSKILLS_LOG_LEVEL: z
        .enum(['debug', 'info', 'warn', 'error'])
        .default(DEFAULT_CONFIG.logLevel),
    CHAINSKILLS_STATE_BACKEND: z
        .enum(['memory', 'sqlite', 'redis'])
        .default(DEFAULT_CONFIG.stateBackend),
    CHAINSKILLS_EXECUTOR: z
        .enum(['simple', 'mastra'])
        .default(DEFAULT_CONFIG.executor),
    CHAINSKILLS_WORKFLOWS_DIR: z
        .string()
        .default(DEFAULT_CONFIG.workflowsDir),
    CHAINSKILLS_GLOBAL_DIR: z
        .string()
        .default(DEFAULT_CONFIG.globalDir),
    MCP_SERVER_PORT: z.coerce
        .number()
        .int()
        .positive()
        .default(DEFAULT_CONFIG.mcpPort),
    CHAINSKILLS_REGISTRY_URL: z
        .string()
        .url()
        .default(DEFAULT_CONFIG.registryUrl),
    CHAINSKILLS_SHELL_TIMEOUT: z.coerce
        .number()
        .int()
        .positive()
        .default(DEFAULT_CONFIG.shellTimeout),
    MCP_TRANSPORT: z
        .enum(['stdio', 'http'])
        .default(DEFAULT_CONFIG.mcpTransport),
    MCP_SERVER_NAME: z
        .string()
        .default(DEFAULT_CONFIG.mcpServerName),
    MCP_SERVER_VERSION: z
        .string()
        .default(DEFAULT_CONFIG.mcpServerVersion),
});

/**
 * Load, validate, and return the application configuration from environment variables.
 *
 * Fails fast with a clear error message if required variables are missing or invalid.
 *
 * @returns Typed `AppConfig` parsed from `process.env`.
 * @throws Error with descriptive message listing all validation issues.
 */
export function loadEnvConfig(): AppConfig {
    const result = EnvSchema.safeParse(process.env);

    if (!result.success) {
        const issues = result.error.issues
            .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
            .join('\n');

        throw new Error(
            `\n[chainskills] Environment validation failed:\n${issues}\n\nSee .env.example for required variables.\n`,
        );
    }

    const env = result.data;

    // Auto-detect agent provider from environment
    const agentProvider = (process.env['AGENT_PROVIDER'] ?? 'noop') as import('./defaults.js').AgentProviderBackend;

    return {
        logLevel: env.CHAINSKILLS_LOG_LEVEL,
        stateBackend: env.CHAINSKILLS_STATE_BACKEND,
        executor: env.CHAINSKILLS_EXECUTOR,
        workflowsDir: env.CHAINSKILLS_WORKFLOWS_DIR,
        globalDir: env.CHAINSKILLS_GLOBAL_DIR,
        mcpPort: env.MCP_SERVER_PORT,
        mcpTransport: env.MCP_TRANSPORT,
        mcpServerName: env.MCP_SERVER_NAME,
        mcpServerVersion: env.MCP_SERVER_VERSION,
        registryUrl: env.CHAINSKILLS_REGISTRY_URL,
        shellTimeout: env.CHAINSKILLS_SHELL_TIMEOUT,
        tracesDir: process.env['TRACES_DIR'] ?? './traces',
        recordTraces: true,
        agentFeedbackEnabled: process.env['AGENT_FEEDBACK_ENABLED'] === 'true',
        agentFeedbackMinConfidence: 0.8,
        agentProvider,
    };
}
