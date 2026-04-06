/**
 * Tests for chainskills distill command logic.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { distillTraces, toJsonl } from '#core/services/distillation.js';
import type { ExecutionTrace } from '#core/entities/execution-trace.js';

function makeTrace(overrides: Partial<ExecutionTrace> = {}): ExecutionTrace {
    return {
        run_id: 'run-distill',
        workflow_name: 'test-wf',
        step_id: 'step-1',
        directive_type: 'agent',
        timestamp: '2026-04-06T00:00:00Z',
        duration_ms: 100,
        status: 'ok',
        input: 'Analyze this',
        output: 'Analysis complete with detailed results.',
        model: 'gpt-4o',
        confidence_score: 0.9,
        ...overrides,
    };
}

describe('distill command logic', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'chainskills-distill-'));
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should load traces from JSONL and distill', () => {
        const traces = [
            makeTrace(),
            makeTrace({ step_id: 's2', confidence_score: 0.8 }),
            makeTrace({ step_id: 's3', status: 'error' }),
        ];
        const jsonl = traces.map((t) => JSON.stringify(t)).join('\n');
        const tracePath = join(tmpDir, 'run-distill.jsonl');
        writeFileSync(tracePath, jsonl);

        // Reload and distill
        const loaded = readFileSync(tracePath, 'utf-8')
            .split('\n')
            .filter(Boolean)
            .map((l) => JSON.parse(l) as ExecutionTrace);

        const examples = distillTraces(loaded, { minConfidence: 0.5 });
        expect(examples).toHaveLength(2); // status=error filtered out
    });

    it('should produce valid OpenAI JSONL format', () => {
        const examples = distillTraces([makeTrace()]);
        const jsonl = toJsonl(examples);
        const lines = jsonl.trim().split('\n');

        expect(lines).toHaveLength(1);
        const parsed = JSON.parse(lines[0]!);
        expect(parsed.messages).toHaveLength(3);
        expect(parsed.messages[0].role).toBe('system');
        expect(parsed.messages[1].role).toBe('user');
        expect(parsed.messages[2].role).toBe('assistant');
    });

    it('should write JSONL output file', () => {
        const examples = distillTraces([makeTrace()]);
        const outputPath = join(tmpDir, 'training.jsonl');
        writeFileSync(outputPath, toJsonl(examples));

        const content = readFileSync(outputPath, 'utf-8');
        expect(content).toContain('"role":"user"');
        expect(content).toContain('"role":"assistant"');
    });

    it('should filter by min confidence', () => {
        const traces = [
            makeTrace({ confidence_score: 0.9 }),
            makeTrace({ confidence_score: 0.3, step_id: 's2' }),
        ];
        const high = distillTraces(traces, { minConfidence: 0.8 });
        const low = distillTraces(traces, { minConfidence: 0.1 });

        expect(high).toHaveLength(1);
        expect(low).toHaveLength(2);
    });

    it('should handle empty trace file', () => {
        const examples = distillTraces([]);
        expect(examples).toHaveLength(0);
        expect(toJsonl(examples)).toBe('');
    });
});
