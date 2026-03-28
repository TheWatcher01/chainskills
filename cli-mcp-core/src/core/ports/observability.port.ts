/**
 * Observability port — abstract tracing and metrics interface.
 *
 * Implementations may use console logging, OpenTelemetry, Langfuse, etc.
 * Core domain uses this port without coupling to any specific backend.
 *
 * @module core/ports/observability
 */

/** A trace span representing a unit of work. */
export interface Span {
    /** Unique span identifier. */
    readonly id: string;
    /** Span name (e.g., step ID, directive type). */
    readonly name: string;
    /** Start timestamp (epoch ms). */
    readonly startTime: number;
    /** End the span, recording optional attributes. */
    end(attributes?: Record<string, unknown>): void;
}

/** Observability port for tracing workflow execution. */
export interface ObservabilityPort {
    /** Start a new trace span. */
    startSpan(name: string, attributes?: Record<string, unknown>): Span;
    /** Record a numeric metric. */
    recordMetric(name: string, value: number, tags?: Record<string, string>): void;
}
