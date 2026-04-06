#!/bin/bash
rm -rf /tmp/replay-test
mkdir -p /tmp/replay-test
cat > /tmp/replay-test/logger.ts << 'TSEOF'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0, info: 1, warn: 2, error: 3,
};

export class Logger {
    private level: LogLevel;

    constructor(level: LogLevel = 'info') {
        this.level = level;
    }

    private shouldLog(level: LogLevel): boolean {
        return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.level];
    }

    debug(message: string): void {
        if (this.shouldLog('debug')) console.log(`[DEBUG] ${message}`);
    }

    info(message: string): void {
        if (this.shouldLog('info')) console.log(`[INFO] ${message}`);
    }

    warn(message: string): void {
        if (this.shouldLog('warn')) console.warn(`[WARN] ${message}`);
    }

    error(message: string): void {
        if (this.shouldLog('error')) console.error(`[ERROR] ${message}`);
    }
}
TSEOF
