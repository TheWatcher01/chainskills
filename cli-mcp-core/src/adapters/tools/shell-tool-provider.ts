/**
 * Shell tool provider adapter.
 *
 * Implements the `ToolProvider` port for executing shell commands via
 * `@call shell.exec(command)` directives.
 *
 * Security: commands are validated, timeouts enforced, and execution
 * is disabled in `--dry-run` mode.
 *
 * @module adapters/tools/shell-tool-provider
 */

import { execSync } from 'node:child_process';
import type { Result } from '#infra/errors.js';
import type { ToolError } from '#infra/errors.js';
import { ok, err, toolError } from '#infra/errors.js';
import type { ToolProvider } from '#core/ports/tool-provider.port.js';
import type { Logger } from '#infra/logger.js';

/** Configuration for the shell tool provider. */
export interface ShellToolConfig {
    /** Default timeout per command in milliseconds. */
    readonly timeout: number;
    /** When true, log commands but don't execute. */
    readonly dryRun: boolean;
    /** Working directory for commands. */
    readonly cwd?: string;
    /** Maximum output size in bytes. */
    readonly maxBuffer?: number;
}

const DEFAULT_CONFIG: ShellToolConfig = {
    timeout: 30_000,
    dryRun: false,
    maxBuffer: 1024 * 1024 * 10, // 10 MB
};

/**
 * Create a shell `ToolProvider`.
 *
 * Supports the `shell` tool with the `exec` method:
 * - `@call shell.exec($command) → $output`
 *
 * @param config - Shell execution configuration.
 * @param logger - Optional logger for command tracing.
 * @returns A `ToolProvider` implementation.
 */
export function createShellToolProvider(
    config: Partial<ShellToolConfig> = {},
    logger?: Logger,
): ToolProvider {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    return {
        has(tool: string, method: string): boolean {
            return tool === 'shell' && method === 'exec';
        },

        async call(
            tool: string,
            method: string,
            args: Record<string, unknown>,
        ): Promise<Result<unknown, ToolError>> {
            // Only shell.exec is supported
            if (tool !== 'shell' || method !== 'exec') {
                return err(
                    toolError(
                        'UNSUPPORTED_TOOL',
                        `Tool "${tool}.${method}" is not supported. Available: shell.exec`,
                        tool,
                        method,
                    ),
                );
            }

            // Extract command from args
            const command =
                typeof args['command'] === 'string'
                    ? args['command']
                    : typeof args['input'] === 'string'
                        ? args['input']
                        : String(args['0'] ?? '');

            if (!command || command.trim().length === 0) {
                return err(
                    toolError(
                        'EMPTY_COMMAND',
                        'Shell command is empty',
                        tool,
                        method,
                    ),
                );
            }

            // Dry-run: log but don't execute
            if (cfg.dryRun) {
                logger?.info('[dry-run] shell.exec', { command });
                return ok(`[dry-run] Would execute: ${command}`);
            }

            // Execute
            logger?.debug('shell.exec', { command, timeout: cfg.timeout });

            try {
                const output = execSync(command, {
                    encoding: 'utf-8',
                    timeout: cfg.timeout,
                    cwd: cfg.cwd,
                    maxBuffer: cfg.maxBuffer,
                    stdio: ['pipe', 'pipe', 'pipe'],
                });

                logger?.debug('shell.exec completed', {
                    command,
                    outputLength: output.length,
                });

                return ok(output.trim());
            } catch (e) {
                const message =
                    e instanceof Error ? e.message : String(e);
                logger?.error('shell.exec failed', { command, error: message });
                return err(
                    toolError('SHELL_ERROR', message, tool, method),
                );
            }
        },
    };
}
