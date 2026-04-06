/**
 * Claude Code session transcript parser.
 *
 * Parses JSONL session transcripts from ~/.claude/projects/{path}/sessions/{id}.jsonl
 * into chainskills ExecutionTrace[] format.
 *
 * Supports both raw Claude Code transcripts and chainskills recorder hook output.
 *
 * @module adapters/capture/session-parser
 */

import { readFileSync } from 'node:fs';
import { createTrace, type ExecutionTrace } from '#core/entities/execution-trace.js';
import { randomUUID } from 'node:crypto';

// ─── Claude Code Transcript Types ────────────────────────────────────────────

/** A content block in an assistant message. */
interface ToolUseBlock {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
}

interface ToolResultBlock {
    type: 'tool_result';
    tool_use_id: string;
    content: string | Array<{ type: string; text?: string }>;
}

interface TextBlock {
    type: 'text';
    text: string;
}

type ContentBlock = ToolUseBlock | ToolResultBlock | TextBlock | { type: string };

/** A line in the Claude Code JSONL transcript. */
interface TranscriptLine {
    type: string;
    message?: {
        role?: string;
        content?: ContentBlock[] | string;
    };
    sessionId?: string;
    timestamp?: string;
    userType?: string;
}

/** A line from the chainskills recorder hook output. */
interface RecorderLine {
    ts: string;
    event: 'pre' | 'post';
    session_id: string;
    tool: string;
    input: Record<string, unknown>;
}

/** Grouped task from a session. */
export interface TaskGroup {
    /** User prompt that initiated this task. */
    readonly prompt: string;
    /** Tool calls executed for this task. */
    readonly toolCalls: Array<{
        readonly tool: string;
        readonly input: Record<string, unknown>;
        readonly output: string;
        readonly timestamp: string;
    }>;
    /** Start timestamp. */
    readonly startedAt: string;
    /** End timestamp. */
    readonly endedAt: string;
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

/**
 * Parse a Claude Code session JSONL transcript into ExecutionTraces.
 *
 * Extracts tool_use → tool_result pairs and converts them to traces.
 */
export function parseClaudeCodeSession(jsonlPath: string): ExecutionTrace[] {
    const content = readFileSync(jsonlPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    const toolUses = new Map<string, { name: string; input: Record<string, unknown>; timestamp: string }>();
    const traces: ExecutionTrace[] = [];
    const runId = randomUUID();
    let currentUserPrompt = '';
    let lineTimestamp = new Date().toISOString();

    for (const line of lines) {
        let parsed: TranscriptLine;
        try {
            parsed = JSON.parse(line) as TranscriptLine;
        } catch {
            continue;
        }

        if (parsed.timestamp) {
            lineTimestamp = parsed.timestamp;
        }

        // Capturer le prompt utilisateur
        if (parsed.type === 'user' || parsed.userType === 'user') {
            const msg = parsed.message;
            if (msg && typeof msg.content === 'string') {
                currentUserPrompt = msg.content.slice(0, 200);
            } else if (msg && Array.isArray(msg.content)) {
                const text = msg.content.find((b): b is TextBlock => b.type === 'text');
                if (text) currentUserPrompt = text.text.slice(0, 200);
            }
        }

        // Extraire tool_use blocks des messages assistant
        if (parsed.type === 'assistant') {
            const content = parsed.message?.content;
            if (!Array.isArray(content)) continue;

            for (const block of content) {
                if (block.type === 'tool_use') {
                    const tu = block as ToolUseBlock;
                    toolUses.set(tu.id, {
                        name: tu.name,
                        input: tu.input,
                        timestamp: lineTimestamp,
                    });
                }
            }
        }

        // tool_result arrive dans les messages "user" (convention Anthropic API)
        if (parsed.type === 'user' || parsed.userType === 'user') {
            const content = parsed.message?.content;
            if (!Array.isArray(content)) continue;

            for (const block of content) {
                if (block.type === 'tool_result') {
                    const tr = block as ToolResultBlock;
                    const matching = toolUses.get(tr.tool_use_id);
                    if (!matching) continue;

                    // Extraire le texte du resultat
                    let output = '';
                    if (typeof tr.content === 'string') {
                        output = tr.content;
                    } else if (Array.isArray(tr.content)) {
                        output = tr.content
                            .filter((c) => c.type === 'text' && c.text)
                            .map((c) => (c as { text: string }).text)
                            .join('\n');
                    }

                    traces.push(createTrace({
                        run_id: runId,
                        workflow_name: `session:${parsed.sessionId ?? 'unknown'}`,
                        step_id: `tool-${matching.name}-${traces.length}`,
                        directive_type: mapToolToDirective(matching.name),
                        timestamp: matching.timestamp,
                        duration_ms: 0,
                        status: output.includes('Exit code') || output.includes('ELIFECYCLE') ? 'error' : 'ok',
                        input: JSON.stringify({ tool: matching.name, ...matching.input }).slice(0, 2000),
                        output: output.slice(0, 5000),
                        variables_snapshot: { user_prompt: currentUserPrompt },
                    }));

                    toolUses.delete(tr.tool_use_id);
                }
            }
        }
    }

    return traces;
}

/**
 * Parse chainskills recorder hook JSONL output into ExecutionTraces.
 */
export function parseRecorderCapture(jsonlPath: string): ExecutionTrace[] {
    const content = readFileSync(jsonlPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    const preEvents = new Map<string, RecorderLine>();
    const traces: ExecutionTrace[] = [];
    const runId = randomUUID();

    for (const line of lines) {
        let parsed: RecorderLine;
        try {
            parsed = JSON.parse(line) as RecorderLine;
        } catch {
            continue;
        }

        if (parsed.event === 'pre') {
            // Cle unique : tool + timestamp (approximatif)
            preEvents.set(`${parsed.tool}:${parsed.ts}`, parsed);
        }

        if (parsed.event === 'post') {
            // Matcher avec le pre le plus recent pour le meme outil
            const key = [...preEvents.keys()].reverse().find((k) => k.startsWith(`${parsed.tool}:`));
            const preEvent = key ? preEvents.get(key) : undefined;

            traces.push(createTrace({
                run_id: runId,
                workflow_name: `capture:${parsed.session_id}`,
                step_id: `tool-${parsed.tool}-${traces.length}`,
                directive_type: mapToolToDirective(parsed.tool),
                timestamp: preEvent?.ts ?? parsed.ts,
                duration_ms: preEvent ? Date.parse(parsed.ts) - Date.parse(preEvent.ts) : 0,
                status: 'ok',
                input: JSON.stringify(preEvent?.input ?? parsed.input).slice(0, 2000),
                output: JSON.stringify(parsed.input).slice(0, 5000), // PostToolUse has result in input
            }));

            if (key) preEvents.delete(key);
        }
    }

    return traces;
}

/**
 * Group traces by user task (delimited by user messages in transcript).
 */
export function groupByTask(jsonlPath: string): TaskGroup[] {
    const content = readFileSync(jsonlPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    const groups: TaskGroup[] = [];
    let currentGroup: TaskGroup | null = null;

    for (const line of lines) {
        let parsed: TranscriptLine;
        try {
            parsed = JSON.parse(line) as TranscriptLine;
        } catch {
            continue;
        }

        // Nouveau message user = nouvelle tache
        if (parsed.type === 'user' || parsed.userType === 'user') {
            if (currentGroup && currentGroup.toolCalls.length > 0) {
                groups.push(currentGroup);
            }
            const prompt = typeof parsed.message?.content === 'string'
                ? parsed.message.content
                : '';
            currentGroup = {
                prompt,
                toolCalls: [],
                startedAt: parsed.timestamp ?? new Date().toISOString(),
                endedAt: parsed.timestamp ?? new Date().toISOString(),
            };
        }

        // Tool use dans le groupe courant
        if (parsed.type === 'assistant' && currentGroup) {
            const content = parsed.message?.content;
            if (!Array.isArray(content)) continue;

            for (const block of content) {
                if (block.type === 'tool_use') {
                    const tu = block as ToolUseBlock;
                    (currentGroup.toolCalls as Array<{ tool: string; input: Record<string, unknown>; output: string; timestamp: string }>).push({
                        tool: tu.name,
                        input: tu.input,
                        output: '', // Rempli plus tard par tool_result
                        timestamp: parsed.timestamp ?? new Date().toISOString(),
                    });
                    currentGroup = { ...currentGroup, endedAt: parsed.timestamp ?? currentGroup.endedAt };
                }
            }
        }
    }

    // Dernier groupe
    if (currentGroup && currentGroup.toolCalls.length > 0) {
        groups.push(currentGroup);
    }

    return groups;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map Claude Code tool names to chainskills directive types. */
function mapToolToDirective(toolName: string): string {
    switch (toolName) {
        case 'Bash': return 'call';
        case 'Read': return 'call';
        case 'Write': return 'output';
        case 'Edit': return 'output';
        case 'Grep': return 'call';
        case 'Glob': return 'call';
        case 'Agent': return 'agent';
        case 'Skill': return 'workflow';
        default:
            if (toolName.startsWith('mcp__')) return 'call';
            return 'call';
    }
}
