/**
 * Claude Code cost reader — extracts real cost data from Claude Code's project config.
 *
 * Reads `~/.claude/projects/{path}/config.json` which is persisted by
 * Claude Code's `saveCurrentSessionCosts()` on session exit.
 *
 * @module adapters/capture/claude-cost-reader
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/** Cost data from a Claude Code session. */
export interface SessionCosts {
    /** Session ID. */
    readonly sessionId: string;
    /** Total cost in USD. */
    readonly totalCost_usd: number;
    /** Total input tokens. */
    readonly totalInputTokens: number;
    /** Total output tokens. */
    readonly totalOutputTokens: number;
    /** Cache read tokens. */
    readonly cacheReadTokens: number;
    /** Cache creation tokens. */
    readonly cacheCreationTokens: number;
    /** Total API duration (ms). */
    readonly apiDuration_ms: number;
    /** Total session duration (ms). */
    readonly sessionDuration_ms: number;
    /** Lines added. */
    readonly linesAdded: number;
    /** Lines removed. */
    readonly linesRemoved: number;
    /** Per-model usage breakdown. */
    readonly modelUsage: Record<string, {
        readonly inputTokens: number;
        readonly outputTokens: number;
        readonly cacheReadInputTokens: number;
        readonly cacheCreationInputTokens: number;
        readonly costUSD: number;
    }>;
}

/**
 * Read Claude Code session costs from project config.
 *
 * @param projectPath - Path to the project (used to find the Claude config).
 * @returns Session costs or null if not found.
 */
export function readClaudeCodeCosts(projectPath?: string): SessionCosts | null {
    const claudeHome = join(homedir(), '.claude');
    const projectsDir = join(claudeHome, 'projects');

    if (!existsSync(projectsDir)) return null;

    // Find the most recent project config
    let configPath: string | null = null;

    if (projectPath) {
        // Encode path like Claude Code does (replace / with -)
        const encoded = projectPath.replace(/\//g, '-').replace(/^-/, '');
        const candidatePath = join(projectsDir, encoded, 'config.json');
        if (existsSync(candidatePath)) configPath = candidatePath;
    }

    if (!configPath) {
        // Try to find any project config
        try {
            const dirs = readdirSync(projectsDir);
            for (const dir of dirs) {
                const candidate = join(projectsDir, dir, 'config.json');
                if (existsSync(candidate)) {
                    configPath = candidate;
                    break;
                }
            }
        } catch {
            return null;
        }
    }

    if (!configPath) return null;

    try {
        const content = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content) as Record<string, unknown>;

        return {
            sessionId: String(config['lastSessionId'] ?? ''),
            totalCost_usd: Number(config['lastCost'] ?? 0),
            totalInputTokens: Number(config['lastTotalInputTokens'] ?? 0),
            totalOutputTokens: Number(config['lastTotalOutputTokens'] ?? 0),
            cacheReadTokens: Number(config['lastTotalCacheReadInputTokens'] ?? 0),
            cacheCreationTokens: Number(config['lastTotalCacheCreationInputTokens'] ?? 0),
            apiDuration_ms: Number(config['lastAPIDuration'] ?? 0),
            sessionDuration_ms: Number(config['lastDuration'] ?? 0),
            linesAdded: Number(config['lastLinesAdded'] ?? 0),
            linesRemoved: Number(config['lastLinesRemoved'] ?? 0),
            modelUsage: (config['lastModelUsage'] ?? {}) as SessionCosts['modelUsage'],
        };
    } catch {
        return null;
    }
}
