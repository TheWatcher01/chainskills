import { describe, it, expect } from 'vitest';
import { compareTraces } from '#core/services/trace-comparator.js';
import type { ExecutionTrace } from '#core/entities/execution-trace.js';

function trace(overrides: Partial<ExecutionTrace> = {}): ExecutionTrace {
    return {
        run_id: 'run-1',
        workflow_name: 'test',
        step_id: 'step-1',
        directive_type: 'call',
        timestamp: new Date().toISOString(),
        duration_ms: 100,
        status: 'ok',
        input: '{}',
        output: 'done',
        ...overrides,
    };
}

describe('compareTraces', () => {
    it('should report identical traces as equivalent', () => {
        const traces = [
            trace({ directive_type: 'call', input: JSON.stringify({ tool: 'Read', file_path: '/src/a.ts' }) }),
            trace({ directive_type: 'output', input: JSON.stringify({ tool: 'Write', file_path: '/src/b.ts' }) }),
        ];
        const report = compareTraces(traces, traces);

        expect(report.toolOverlap).toBe(1);
        expect(report.fileOverlap).toBe(1);
        expect(report.similarityScore).toBeGreaterThanOrEqual(80);
        expect(report.verdict).toBe('equivalent');
    });

    it('should detect completely different traces', () => {
        const a = [
            trace({ directive_type: 'call', input: JSON.stringify({ tool: 'Bash', command: 'ls' }) }),
        ];
        const b = [
            trace({ directive_type: 'agent', input: JSON.stringify({ tool: 'Agent', prompt: 'research' }) }),
            trace({ directive_type: 'output', input: JSON.stringify({ tool: 'Write', file_path: '/x.ts' }) }),
            trace({ directive_type: 'call', input: JSON.stringify({ tool: 'Grep', pattern: 'foo' }) }),
        ];
        const report = compareTraces(a, b);

        expect(report.toolOverlap).toBeLessThan(0.5);
        expect(report.verdict).toBe('failed');
    });

    it('should handle empty trace sets', () => {
        const report = compareTraces([], []);
        expect(report.tracesA).toBe(0);
        expect(report.tracesB).toBe(0);
        expect(report.toolOverlap).toBe(1); // Jaccard(empty, empty) = 1
    });

    it('should compute success rates correctly', () => {
        const a = [trace({ status: 'ok' }), trace({ status: 'ok' })];
        const b = [trace({ status: 'ok' }), trace({ status: 'error' })];
        const report = compareTraces(a, b);

        expect(report.successRateA).toBe(1);
        expect(report.successRateB).toBe(0.5);
    });

    it('should compute duration ratio', () => {
        const a = [trace({ duration_ms: 100 }), trace({ duration_ms: 100 })];
        const b = [trace({ duration_ms: 50 }), trace({ duration_ms: 50 })];
        const report = compareTraces(a, b);

        expect(report.durationRatio).toBe(0.5); // B is 2x faster
    });

    it('should extract file paths from inputs', () => {
        const a = [trace({ input: JSON.stringify({ file_path: '/src/foo.ts' }) })];
        const b = [trace({ input: JSON.stringify({ file_path: '/src/foo.ts' }) })];
        const report = compareTraces(a, b);

        expect(report.fileOverlap).toBe(1);
    });
});
