import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseClaudeCodeSession, parseRecorderCapture, groupByTask } from '#adapters/capture/session-parser.js';

let tmpDir: string;

beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'chainskills-parser-test-'));
});

afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
});

function writeJsonl(name: string, lines: unknown[]): string {
    const path = join(tmpDir, name);
    writeFileSync(path, lines.map((l) => JSON.stringify(l)).join('\n'));
    return path;
}

describe('parseClaudeCodeSession', () => {
    it('should extract tool_use from assistant + tool_result from user', () => {
        const path = writeJsonl('session.jsonl', [
            {
                type: 'assistant',
                message: {
                    role: 'assistant',
                    content: [{
                        type: 'tool_use',
                        id: 'tu-1',
                        name: 'Read',
                        input: { file_path: '/src/app.ts' },
                    }],
                },
                timestamp: '2026-04-06T10:00:00Z',
            },
            {
                type: 'user',
                message: {
                    role: 'user',
                    content: [{
                        type: 'tool_result',
                        tool_use_id: 'tu-1',
                        content: 'export const app = "hello";',
                    }],
                },
                timestamp: '2026-04-06T10:00:01Z',
            },
        ]);

        const traces = parseClaudeCodeSession(path);
        expect(traces).toHaveLength(1);
        expect(traces[0]!.directive_type).toBe('call');
        expect(traces[0]!.status).toBe('ok');
        expect(traces[0]!.input).toContain('Read');
    });

    it('should handle tool_result with array content', () => {
        const path = writeJsonl('session2.jsonl', [
            {
                type: 'assistant',
                message: {
                    role: 'assistant',
                    content: [{ type: 'tool_use', id: 'tu-2', name: 'Bash', input: { command: 'ls' } }],
                },
            },
            {
                type: 'user',
                message: {
                    role: 'user',
                    content: [{
                        type: 'tool_result',
                        tool_use_id: 'tu-2',
                        content: [{ type: 'text', text: 'file1.ts\nfile2.ts' }],
                    }],
                },
            },
        ]);

        const traces = parseClaudeCodeSession(path);
        expect(traces).toHaveLength(1);
        expect(traces[0]!.output).toContain('file1.ts');
    });

    it('should mark error status for failed commands', () => {
        const path = writeJsonl('session3.jsonl', [
            {
                type: 'assistant',
                message: {
                    role: 'assistant',
                    content: [{ type: 'tool_use', id: 'tu-3', name: 'Bash', input: { command: 'false' } }],
                },
            },
            {
                type: 'user',
                message: {
                    role: 'user',
                    content: [{
                        type: 'tool_result',
                        tool_use_id: 'tu-3',
                        content: 'Exit code 1',
                    }],
                },
            },
        ]);

        const traces = parseClaudeCodeSession(path);
        expect(traces[0]!.status).toBe('error');
    });

    it('should skip invalid JSON lines gracefully', () => {
        const path = join(tmpDir, 'bad.jsonl');
        writeFileSync(path, 'not json\n{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t1","name":"Read","input":{}}]}}\n');

        const traces = parseClaudeCodeSession(path);
        // Should not throw, might extract 0 or more traces
        expect(Array.isArray(traces)).toBe(true);
    });

    it('should map tool names to directive types', () => {
        const path = writeJsonl('session4.jsonl', [
            {
                type: 'assistant',
                message: { content: [{ type: 'tool_use', id: 'w1', name: 'Write', input: { file_path: '/x.ts', content: '' } }] },
            },
            {
                type: 'user',
                message: { content: [{ type: 'tool_result', tool_use_id: 'w1', content: 'File written' }] },
            },
            {
                type: 'assistant',
                message: { content: [{ type: 'tool_use', id: 'a1', name: 'Agent', input: { prompt: 'research' } }] },
            },
            {
                type: 'user',
                message: { content: [{ type: 'tool_result', tool_use_id: 'a1', content: 'Done' }] },
            },
        ]);

        const traces = parseClaudeCodeSession(path);
        expect(traces).toHaveLength(2);
        expect(traces[0]!.directive_type).toBe('output'); // Write → output
        expect(traces[1]!.directive_type).toBe('agent');  // Agent → agent
    });
});

describe('parseRecorderCapture', () => {
    it('should match pre+post events into traces', () => {
        const ts1 = '2026-04-06T10:00:00.000Z';
        const ts2 = '2026-04-06T10:00:00.500Z';
        const path = writeJsonl('recorder.jsonl', [
            { ts: ts1, event: 'pre', session_id: 's1', tool: 'Read', input: { file_path: '/a.ts' } },
            { ts: ts2, event: 'post', session_id: 's1', tool: 'Read', input: { file_path: '/a.ts' } },
        ]);

        const traces = parseRecorderCapture(path);
        expect(traces).toHaveLength(1);
        expect(traces[0]!.duration_ms).toBe(500);
    });
});

describe('groupByTask', () => {
    it('should group tool calls by user messages', () => {
        const path = writeJsonl('grouped.jsonl', [
            { type: 'user', message: { content: 'Fix the bug' }, timestamp: '2026-04-06T10:00:00Z' },
            { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Read', input: {} }] }, timestamp: '2026-04-06T10:00:01Z' },
            { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't2', name: 'Edit', input: {} }] }, timestamp: '2026-04-06T10:00:02Z' },
            { type: 'user', message: { content: 'Now write tests' }, timestamp: '2026-04-06T10:00:03Z' },
            { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't3', name: 'Write', input: {} }] }, timestamp: '2026-04-06T10:00:04Z' },
        ]);

        const groups = groupByTask(path);
        expect(groups).toHaveLength(2);
        expect(groups[0]!.prompt).toBe('Fix the bug');
        expect(groups[0]!.toolCalls).toHaveLength(2);
        expect(groups[1]!.prompt).toBe('Now write tests');
        expect(groups[1]!.toolCalls).toHaveLength(1);
    });
});
