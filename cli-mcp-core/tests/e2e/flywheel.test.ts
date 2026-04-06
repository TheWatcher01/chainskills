/**
 * End-to-end flywheel tests — run → trace → distill pipeline.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createContainer } from '#config/container.js';
import { runWorkflow } from '#core/use-cases/run-workflow.js';
import { distillTraces, toJsonl } from '#core/services/distillation.js';
import { createJsonlTraceStore } from '#adapters/trace-store/jsonl-trace-store.js';
import type { ExecutionTrace } from '#core/entities/execution-trace.js';

const SIMPLE_WORKFLOW = `---
name: e2e-test
description: Simple workflow for E2E testing
version: 0.1.0
inputs:
  - name: target
    type: string
outputs:
  - name: result
    type: string
---

# Process

@call shell.exec(echo "Processing $target") → $result

# Output

@output: $result
`;

describe('Flywheel E2E', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'chainskills-e2e-'));
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should run a workflow and produce traces in JSONL', async () => {
        const tracesDir = join(tmpDir, 'traces');
        const traceStore = createJsonlTraceStore({ directory: tracesDir });

        // Manually create trace to simulate recording
        traceStore.append({
            run_id: 'e2e-run-001',
            workflow_name: 'e2e-test',
            step_id: 'process',
            directive_type: 'call',
            timestamp: new Date().toISOString(),
            duration_ms: 42,
            status: 'ok',
            input: '@call shell.exec(echo "Processing test")',
            output: 'Processing test',
        });
        await traceStore.flush();

        // Verify traces written
        const traces = await traceStore.query({ run_id: 'e2e-run-001' });
        expect(traces).toHaveLength(1);
        expect(traces[0]!.workflow_name).toBe('e2e-test');
    });

    it('should distill traces into fine-tuning JSONL', async () => {
        const traces: ExecutionTrace[] = [
            {
                run_id: 'e2e-run-002',
                workflow_name: 'e2e-test',
                step_id: 'agent-step',
                directive_type: 'agent',
                timestamp: new Date().toISOString(),
                duration_ms: 500,
                status: 'ok',
                input: 'Analyze this code for bugs',
                output: 'No critical bugs found. Minor suggestion: add null check on line 42.',
                model: 'gpt-4o',
                confidence_score: 0.85,
            },
        ];

        const examples = distillTraces(traces, { minConfidence: 0.5 });
        expect(examples).toHaveLength(1);

        const jsonl = toJsonl(examples);
        const outputPath = join(tmpDir, 'training.jsonl');
        writeFileSync(outputPath, jsonl);

        // Verify JSONL is valid
        const content = readFileSync(outputPath, 'utf-8');
        const parsed = JSON.parse(content.trim());
        expect(parsed.messages).toHaveLength(3);
        expect(parsed.messages[1].content).toContain('Analyze this code');
        expect(parsed.messages[2].content).toContain('No critical bugs');
    });

    it('should execute run workflow end-to-end with container', async () => {
        const workflowPath = join(tmpDir, 'e2e-test.workflow.md');
        writeFileSync(workflowPath, SIMPLE_WORKFLOW);

        const container = await createContainer({
            logLevel: 'warn',
            recordTraces: false,
        });

        const result = await runWorkflow(workflowPath, container, {
            inputs: { target: 'hello' },
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.execution.outputs['result']).toContain('Processing hello');
        }
    });
});
