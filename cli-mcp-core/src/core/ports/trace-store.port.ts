/**
 * Trace store port — persists execution traces for learning and distillation.
 *
 * Implementations may write to JSONL files, SQLite, or remote services.
 * The core domain uses this port without coupling to any storage backend.
 *
 * @module core/ports/trace-store
 */

import type { ExecutionTrace, TraceStatus } from '#core/entities/execution-trace.js';

/** Filter criteria for querying traces. */
export interface TraceFilter {
    /** Filter by workflow name. */
    readonly workflow_name?: string;
    /** Filter by execution status. */
    readonly status?: TraceStatus;
    /** Minimum confidence score. */
    readonly min_confidence?: number;
    /** Filter by directive type. */
    readonly directive_type?: string;
    /** Only traces after this date (ISO 8601). */
    readonly since?: string;
    /** Filter by run ID. */
    readonly run_id?: string;
    /** Maximum number of results. */
    readonly limit?: number;
}

/** Trace statistics summary. */
export interface TraceStats {
    readonly total_traces: number;
    readonly total_runs: number;
    readonly by_status: Record<TraceStatus, number>;
    readonly by_directive: Record<string, number>;
    readonly avg_duration_ms: number;
    readonly avg_confidence: number;
    readonly unique_workflows: number;
}

/** Abstract interface for trace persistence. */
export interface TraceStore {
    /** Append a trace to the store (buffered). */
    append(trace: ExecutionTrace): void;
    /** Flush buffered traces to persistent storage. */
    flush(): Promise<void>;
    /** Query traces with optional filters. */
    query(filter?: TraceFilter): Promise<ExecutionTrace[]>;
    /** Count traces matching the filter. */
    count(filter?: TraceFilter): Promise<number>;
    /** Get aggregate statistics. */
    stats(): Promise<TraceStats>;
}
