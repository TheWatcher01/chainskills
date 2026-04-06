/**
 * JSONL TraceStore adapter — local file fallback when CRAG/KG unavailable.
 *
 * Stores traces as one JSON object per line in `{run_id}.jsonl` files.
 *
 * @module adapters/trace-store/jsonl-trace-store
 */

import { writeFile, readFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExecutionTrace } from '#core/entities/execution-trace.js';
import type { TraceStore, TraceFilter, TraceStats } from '#core/ports/trace-store.port.js';
import type { Logger } from '#infra/logger.js';

export function createJsonlTraceStore(config: {
    readonly directory: string;
    readonly logger?: Logger;
}): TraceStore {
    const buffer: ExecutionTrace[] = [];

    return {
        append(trace: ExecutionTrace): void {
            buffer.push(trace);
        },

        async flush(): Promise<void> {
            if (buffer.length === 0) return;

            await mkdir(config.directory, { recursive: true });

            // Group by run_id
            const byRun = new Map<string, ExecutionTrace[]>();
            for (const trace of buffer) {
                const existing = byRun.get(trace.run_id) ?? [];
                existing.push(trace);
                byRun.set(trace.run_id, existing);
            }

            for (const [runId, traces] of byRun) {
                const filePath = join(config.directory, `${runId}.jsonl`);
                const lines = traces.map((t) => JSON.stringify(t)).join('\n') + '\n';
                await writeFile(filePath, lines, { flag: 'a' });
            }

            config.logger?.debug(`Flushed ${buffer.length} traces to ${config.directory}`);
            buffer.length = 0;
        },

        async query(filter?: TraceFilter): Promise<ExecutionTrace[]> {
            const all = await loadAllTraces(config.directory);
            return applyFilter(all, filter);
        },

        async count(filter?: TraceFilter): Promise<number> {
            const results = await this.query(filter);
            return results.length;
        },

        async stats(): Promise<TraceStats> {
            const all = await loadAllTraces(config.directory);
            return computeStats(all);
        },
    };
}

async function loadAllTraces(directory: string): Promise<ExecutionTrace[]> {
    try {
        const files = await readdir(directory);
        const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));
        const traces: ExecutionTrace[] = [];

        for (const file of jsonlFiles) {
            const content = await readFile(join(directory, file), 'utf-8');
            const lines = content.split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    traces.push(JSON.parse(line) as ExecutionTrace);
                } catch {
                    // Skip malformed lines
                }
            }
        }

        return traces;
    } catch {
        return []; // Directory doesn't exist yet
    }
}

function applyFilter(traces: ExecutionTrace[], filter?: TraceFilter): ExecutionTrace[] {
    if (!filter) return traces;

    let result = traces;

    if (filter.run_id) result = result.filter((t) => t.run_id === filter.run_id);
    if (filter.workflow_name) result = result.filter((t) => t.workflow_name === filter.workflow_name);
    if (filter.status) result = result.filter((t) => t.status === filter.status);
    if (filter.directive_type) result = result.filter((t) => t.directive_type === filter.directive_type);
    if (filter.model) result = result.filter((t) => t.model === filter.model);
    if (filter.min_confidence !== undefined) result = result.filter((t) => (t.confidence_score ?? 0) >= filter.min_confidence!);
    if (filter.since) {
        const sinceDate = new Date(filter.since).getTime();
        result = result.filter((t) => new Date(t.timestamp).getTime() >= sinceDate);
    }
    if (filter.limit) result = result.slice(0, filter.limit);

    return result;
}

function computeStats(traces: ExecutionTrace[]): TraceStats {
    const runs = new Set(traces.map((t) => t.run_id));
    const workflows = new Set(traces.map((t) => t.workflow_name));

    const byStatus: Record<string, number> = {};
    const byDirective: Record<string, number> = {};
    let totalDuration = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    for (const t of traces) {
        byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
        byDirective[t.directive_type] = (byDirective[t.directive_type] ?? 0) + 1;
        totalDuration += t.duration_ms;
        if (t.confidence_score !== undefined) {
            totalConfidence += t.confidence_score;
            confidenceCount++;
        }
    }

    return {
        total_traces: traces.length,
        total_runs: runs.size,
        by_status: byStatus as TraceStats['by_status'],
        by_directive: byDirective,
        avg_duration_ms: traces.length > 0 ? totalDuration / traces.length : 0,
        avg_confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
        unique_workflows: workflows.size,
    };
}
