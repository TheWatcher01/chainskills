/**
 * Execution trace — immutable record of a directive execution.
 *
 * Captures input, output, timing, model, tokens, and confidence
 * for every directive executed in a workflow. Foundation for
 * auto-learn, distillation, and observability.
 *
 * @module core/entities/execution-trace
 */

/** Status of a traced execution. */
export type TraceStatus = 'ok' | 'error' | 'skip';

/** Token usage for an LLM call. */
export interface TokenUsage {
    readonly prompt: number;
    readonly completion: number;
    readonly total: number;
}

/** Immutable execution trace record. */
export interface ExecutionTrace {
    /** Unique run identifier (UUID). */
    readonly run_id: string;
    /** Workflow name from frontmatter. */
    readonly workflow_name: string;
    /** Step ID where the directive was executed. */
    readonly step_id: string;
    /** Directive type (@call, @agent, @assert, etc.). */
    readonly directive_type: string;
    /** Timestamp of execution start (ISO 8601). */
    readonly timestamp: string;
    /** Duration in milliseconds. */
    readonly duration_ms: number;
    /** Execution status. */
    readonly status: TraceStatus;
    /** Input prompt or command. */
    readonly input: string;
    /** Output result (stringified). */
    readonly output: string;
    /** LLM model used (if applicable). */
    readonly model?: string;
    /** Token usage (if LLM call). */
    readonly tokens?: TokenUsage;
    /** Confidence score (0.0-1.0) if available. */
    readonly confidence_score?: number;
    /** Error message if status is 'error'. */
    readonly error?: string;
    /** Model tier used (gold/silver/bronze). */
    readonly tier?: string;
    /** Snapshot of workflow variables at execution time. */
    readonly variables_snapshot?: Record<string, unknown>;
}

/** Create an ExecutionTrace with current timestamp. */
export function createTrace(
    fields: Omit<ExecutionTrace, 'timestamp'> & { timestamp?: string },
): ExecutionTrace {
    return {
        ...fields,
        timestamp: fields.timestamp ?? new Date().toISOString(),
    };
}
