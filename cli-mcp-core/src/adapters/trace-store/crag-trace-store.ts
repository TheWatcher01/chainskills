/**
 * CRAG/KG TraceStore adapter — persists traces to the existing memory infrastructure.
 *
 * Uses the MCP client to call CRAG KV, CRAG Memory, and Knowledge Graph servers
 * that are already configured in the Claude Code ecosystem.
 *
 * - CRAG KV: indexed lookup by key (O(1))
 * - CRAG Memory: vector search for semantic queries
 * - Knowledge Graph: entity/relation persistence for workflow runs
 *
 * Falls back gracefully if MCP servers are unavailable.
 *
 * @module adapters/trace-store/crag-trace-store
 */

import type { ExecutionTrace } from '#core/entities/execution-trace.js';
import type { TraceStore, TraceFilter, TraceStats } from '#core/ports/trace-store.port.js';
import type { ToolProvider } from '#core/ports/tool-provider.port.js';
import type { Logger } from '#infra/logger.js';

export function createCragTraceStore(config: {
    readonly mcpClient: ToolProvider;
    readonly logger?: Logger;
}): TraceStore {
    const buffer: ExecutionTrace[] = [];

    async function callMcp(method: string, args: Record<string, unknown>): Promise<unknown> {
        const result = await config.mcpClient.call('mcp', method, args);
        if (result.ok) return result.value;
        config.logger?.debug(`CRAG MCP call ${method} failed: ${result.error.message}`);
        return undefined;
    }

    return {
        append(trace: ExecutionTrace): void {
            buffer.push(trace);
        },

        async flush(): Promise<void> {
            if (buffer.length === 0) return;

            const traces = [...buffer];
            buffer.length = 0;

            // Group by run_id for meta summary
            const byRun = new Map<string, ExecutionTrace[]>();
            for (const trace of traces) {
                const existing = byRun.get(trace.run_id) ?? [];
                existing.push(trace);
                byRun.set(trace.run_id, existing);
            }

            for (const [runId, runTraces] of byRun) {
                const firstTrace = runTraces[0]!;
                const hasError = runTraces.some((t) => t.status === 'error');
                const totalDuration = runTraces.reduce((sum, t) => sum + t.duration_ms, 0);

                // CRAG KV: store individual traces
                for (const trace of runTraces) {
                    await callMcp('crag_kv_set', {
                        key: `trace:${runId}:${trace.step_id}:${trace.directive_type}`,
                        value: JSON.stringify(trace),
                    });
                }

                // CRAG KV: store run meta
                const meta = {
                    run_id: runId,
                    workflow_name: firstTrace.workflow_name,
                    status: hasError ? 'error' : 'ok',
                    duration_ms: totalDuration,
                    step_count: runTraces.length,
                    timestamp: firstTrace.timestamp,
                };
                await callMcp('crag_kv_set', {
                    key: `run:${runId}:meta`,
                    value: JSON.stringify(meta),
                });

                // CRAG Memory: store summary for semantic search
                const summary = `Workflow "${firstTrace.workflow_name}" run ${runId}: ${runTraces.length} steps, ${hasError ? 'FAILED' : 'OK'}, ${totalDuration}ms`;
                await callMcp('crag_memory_store', {
                    content: summary,
                    type: 'trace',
                    project: 'chainskills',
                });

                // Knowledge Graph: create entities and relations
                await callMcp('memory_create_entities', {
                    entities: [
                        {
                            name: `run:${runId}`,
                            entityType: 'workflow_run',
                            observations: [summary],
                        },
                    ],
                });

                await callMcp('memory_create_relations', {
                    relations: [
                        {
                            from: `run:${runId}`,
                            to: `workflow:${firstTrace.workflow_name}`,
                            relationType: 'EXECUTED',
                        },
                    ],
                });
            }

            config.logger?.debug(`Flushed ${traces.length} traces to CRAG/KG`);
        },

        async query(filter?: TraceFilter): Promise<ExecutionTrace[]> {
            if (!filter) {
                // List recent trace keys
                const keys = await callMcp('crag_kv_list', { prefix: 'trace:' }) as string[] | undefined;
                if (!keys || !Array.isArray(keys)) return [];
                return loadTracesFromKeys(keys.slice(0, 100));
            }

            if (filter.run_id) {
                const keys = await callMcp('crag_kv_list', { prefix: `trace:${filter.run_id}:` }) as string[] | undefined;
                if (!keys || !Array.isArray(keys)) return [];
                return loadTracesFromKeys(keys);
            }

            if (filter.workflow_name) {
                // Use CRAG memory semantic search
                const results = await callMcp('crag_memory_query', {
                    query: `workflow "${filter.workflow_name}" traces`,
                    project: 'chainskills',
                    top_k: filter.limit ?? 20,
                }) as Array<{ content: string }> | undefined;

                if (!results || !Array.isArray(results)) return [];

                // Extract run IDs from memory results and fetch full traces
                const traces: ExecutionTrace[] = [];
                for (const r of results) {
                    const runIdMatch = String(r.content ?? r).match(/run ([a-f0-9-]+)/);
                    if (runIdMatch) {
                        const runTraces = await this.query({ run_id: runIdMatch[1] });
                        traces.push(...runTraces);
                    }
                }
                return filter.limit ? traces.slice(0, filter.limit) : traces;
            }

            // Generic query: list all and filter
            const all = await this.query();
            let result = all;
            if (filter.status) result = result.filter((t) => t.status === filter.status);
            if (filter.directive_type) result = result.filter((t) => t.directive_type === filter.directive_type);
            if (filter.min_confidence !== undefined) result = result.filter((t) => (t.confidence_score ?? 0) >= filter.min_confidence!);
            if (filter.since) {
                const sinceDate = new Date(filter.since).getTime();
                result = result.filter((t) => new Date(t.timestamp).getTime() >= sinceDate);
            }
            if (filter.limit) result = result.slice(0, filter.limit);
            return result;
        },

        async count(filter?: TraceFilter): Promise<number> {
            const results = await this.query(filter);
            return results.length;
        },

        async stats(): Promise<TraceStats> {
            // Try cached stats first
            const cached = await callMcp('crag_kv_get', { key: 'chainskills:trace_stats' }) as string | undefined;
            if (cached) {
                try {
                    return JSON.parse(cached) as TraceStats;
                } catch {
                    // Recompute
                }
            }

            const all = await this.query();
            const runs = new Set(all.map((t) => t.run_id));
            const workflows = new Set(all.map((t) => t.workflow_name));

            const byStatus: Record<string, number> = {};
            const byDirective: Record<string, number> = {};
            let totalDuration = 0;
            let totalConfidence = 0;
            let confidenceCount = 0;

            for (const t of all) {
                byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
                byDirective[t.directive_type] = (byDirective[t.directive_type] ?? 0) + 1;
                totalDuration += t.duration_ms;
                if (t.confidence_score !== undefined) {
                    totalConfidence += t.confidence_score;
                    confidenceCount++;
                }
            }

            const stats: TraceStats = {
                total_traces: all.length,
                total_runs: runs.size,
                by_status: byStatus as TraceStats['by_status'],
                by_directive: byDirective,
                avg_duration_ms: all.length > 0 ? totalDuration / all.length : 0,
                avg_confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
                unique_workflows: workflows.size,
            };

            // Cache stats
            await callMcp('crag_kv_set', {
                key: 'chainskills:trace_stats',
                value: JSON.stringify(stats),
            });

            return stats;
        },
    };

    async function loadTracesFromKeys(keys: string[]): Promise<ExecutionTrace[]> {
        const traces: ExecutionTrace[] = [];
        for (const key of keys) {
            const value = await callMcp('crag_kv_get', { key }) as string | undefined;
            if (value) {
                try {
                    traces.push(JSON.parse(value) as ExecutionTrace);
                } catch {
                    // Skip malformed entries
                }
            }
        }
        return traces;
    }
}
