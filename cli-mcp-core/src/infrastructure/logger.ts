/**
 * Structured JSON logger with correlation ID support.
 *
 * Levels: debug < info < warn < error.
 * Output: one JSON object per line to stderr (keeps stdout clean for CLI output).
 *
 * @module infrastructure/logger
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Supported log levels, ordered by verbosity (debug = most verbose). */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Structured log entry emitted by the logger. */
export interface LogEntry {
    readonly timestamp: string;
    readonly level: LogLevel;
    readonly message: string;
    readonly correlationId?: string;
    readonly data?: Record<string, unknown>;
}

/** Minimal logger interface — can be used as a port in core if needed. */
export interface Logger {
    debug(message: string, data?: Record<string, unknown>): void;
    info(message: string, data?: Record<string, unknown>): void;
    warn(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
    /** Create a child logger with a bound correlation ID. */
    child(correlationId: string): Logger;
}

// ─── Implementation ──────────────────────────────────────────────────────────

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

/**
 * Parse a string into a valid `LogLevel`, falling back to `'info'`.
 */
export function parseLogLevel(raw: string | undefined): LogLevel {
    if (raw && raw in LEVEL_PRIORITY) return raw as LogLevel;
    return 'info';
}

/**
 * Create a structured JSON logger.
 *
 * @param level - Minimum level to emit (messages below this are discarded).
 * @param correlationId - Optional correlation ID bound to every entry.
 */
export function createLogger(
    level: LogLevel = 'info',
    correlationId?: string,
): Logger {
    const minPriority = LEVEL_PRIORITY[level];

    function emit(
        lvl: LogLevel,
        message: string,
        data?: Record<string, unknown>,
    ): void {
        if (LEVEL_PRIORITY[lvl] < minPriority) return;

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: lvl,
            message,
            ...(correlationId ? { correlationId } : {}),
            ...(data && Object.keys(data).length > 0 ? { data } : {}),
        };

        process.stderr.write(JSON.stringify(entry) + '\n');
    }

    return {
        debug: (msg, data) => emit('debug', msg, data),
        info: (msg, data) => emit('info', msg, data),
        warn: (msg, data) => emit('warn', msg, data),
        error: (msg, data) => emit('error', msg, data),
        child: (id: string) => createLogger(level, id),
    };
}
