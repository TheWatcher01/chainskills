/**
 * Shell tool provider adapter.
 *
 * Implements the `ToolProvider` port for executing shell commands via
 * `@call shell.exec(command)` directives.
 *
 * Security:
 * - Uses `execFileSync` instead of `execSync` to prevent shell interpretation.
 * - Rejects dangerous shell metacharacters (`;`, `|`, `&`, `` ` ``, `$()`, `>`, `<`).
 * - Only allows commands from a configurable allowlist.
 * - Passes an explicit env whitelist instead of inheriting `process.env`.
 * - Timeouts enforced, disabled in `--dry-run` mode.
 *
 * @module adapters/tools/shell-tool-provider
 */

import { execFileSync } from 'node:child_process';
import type { Result } from '#infra/errors.js';
import type { ToolError } from '#infra/errors.js';
import { ok, err, toolError } from '#infra/errors.js';
import type { ToolProvider } from '#core/ports/tool-provider.port.js';
import type { Logger } from '#infra/logger.js';

/**
 * Default allowlist of shell commands considered safe.
 * Configurable via `CHAINSKILLS_SHELL_ALLOWLIST` env var (comma-separated).
 */
export const DEFAULT_SHELL_ALLOWLIST: readonly string[] = [
    'echo', 'cat', 'ls', 'grep', 'find', 'curl', 'git', 'node', 'npm', 'pnpm', 'npx',
    'head', 'tail', 'wc', 'sort', 'uniq', 'cut', 'tr', 'sed', 'awk', 'jq', 'date', 'whoami',
];

/**
 * Regex matching dangerous shell metacharacters.
 * Any command containing these is rejected before execution.
 */
const SHELL_METACHAR_PATTERN = /[;|&`$()><\n\r]/;

/**
 * Environment variables safe to forward to child processes.
 * Never forward secrets or sensitive vars.
 */
const SAFE_ENV_KEYS: readonly string[] = [
    'PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'TERM', 'SHELL',
    'NODE_ENV', 'TMPDIR', 'TMP', 'TEMP',
];

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
    /** Allowlist of permitted binary names. */
    readonly allowlist?: readonly string[];
}

const DEFAULT_CONFIG: ShellToolConfig = {
    timeout: 30_000,
    dryRun: false,
    maxBuffer: 1024 * 1024 * 10, // 10 MB
    allowlist: DEFAULT_SHELL_ALLOWLIST,
};

/**
 * Build a safe env object containing only whitelisted variables.
 *
 * @returns A sanitized environment record.
 */
function buildSafeEnv(): Record<string, string> {
    const safeEnv: Record<string, string> = {};
    for (const key of SAFE_ENV_KEYS) {
        const val = process.env[key];
        if (val !== undefined) {
            safeEnv[key] = val;
        }
    }
    return safeEnv;
}

/**
 * Parse a raw command string into binary + args array.
 *
 * Handles basic quoting (double and single quotes) but does NOT
 * interpret shell expansion — that's the point.
 *
 * @param raw - The raw command string from the directive.
 * @returns Tuple of `[binary, args[]]`.
 */
function parseCommand(raw: string): [string, string[]] {
    // Strip outer matching quotes — e.g. `"echo hello"` → `echo hello`
    const trimmed = raw.trim();
    const stripped =
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'"))
            ? trimmed.slice(1, -1)
            : trimmed;

    const tokens: string[] = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < stripped.length; i++) {
        const ch = stripped[i]!;
        if (ch === "'" && !inDouble) {
            inSingle = !inSingle;
        } else if (ch === '"' && !inSingle) {
            inDouble = !inDouble;
        } else if (ch === ' ' && !inSingle && !inDouble) {
            if (current.length > 0) {
                tokens.push(current);
                current = '';
            }
        } else {
            current += ch;
        }
    }
    if (current.length > 0) tokens.push(current);

    const binary = tokens[0] ?? '';
    const args = tokens.slice(1);
    return [binary, args];
}

/**
 * Create a shell `ToolProvider`.
 *
 * Supports the `shell` tool with the `exec` method:
 * - `@call shell.exec($command) → $output`
 *
 * Security hardened:
 * - Rejects metacharacters (`;`, `|`, `&`, `` ` ``, `$()`, `>`, `<`)
 * - Only allows binaries from the configured allowlist
 * - Uses `execFileSync` — no shell interpretation
 * - Passes sanitized env (no secrets leak)
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
    const allowlist = new Set(cfg.allowlist ?? DEFAULT_SHELL_ALLOWLIST);

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

            // Security: reject shell metacharacters
            if (SHELL_METACHAR_PATTERN.test(command)) {
                logger?.warn('shell.exec rejected — metacharacters detected', { command });
                return err(
                    toolError(
                        'SHELL_INJECTION',
                        `Shell metacharacters detected in command. Forbidden characters: ; | & \` $() > <. Got: "${command}"`,
                        tool,
                        method,
                    ),
                );
            }

            // Parse into binary + args
            const [binary, cmdArgs] = parseCommand(command.trim());

            if (!binary) {
                return err(
                    toolError('EMPTY_COMMAND', 'Shell command binary is empty', tool, method),
                );
            }

            // Security: check allowlist
            if (!allowlist.has(binary)) {
                logger?.warn('shell.exec rejected — binary not in allowlist', { binary });
                return err(
                    toolError(
                        'COMMAND_NOT_ALLOWED',
                        `Command "${binary}" is not in the allowed list. Allowed: ${[...allowlist].join(', ')}`,
                        tool,
                        method,
                    ),
                );
            }

            // Dry-run: log but don't execute
            if (cfg.dryRun) {
                logger?.info('[dry-run] shell.exec', { binary, args: cmdArgs });
                return ok(`[dry-run] Would execute: ${binary} ${cmdArgs.join(' ')}`);
            }

            // Execute with execFileSync — no shell interpretation
            logger?.debug('shell.exec', { binary, args: cmdArgs, timeout: cfg.timeout });

            try {
                const output = execFileSync(binary, cmdArgs, {
                    encoding: 'utf-8',
                    timeout: cfg.timeout,
                    cwd: cfg.cwd,
                    maxBuffer: cfg.maxBuffer,
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: buildSafeEnv(),
                });

                logger?.debug('shell.exec completed', {
                    binary,
                    outputLength: output.length,
                });

                return ok(output.trim());
            } catch (e) {
                const message =
                    e instanceof Error ? e.message : String(e);
                logger?.error('shell.exec failed', { binary, args: cmdArgs, error: message });
                return err(
                    toolError('SHELL_ERROR', message, tool, method),
                );
            }
        },
    };
}
