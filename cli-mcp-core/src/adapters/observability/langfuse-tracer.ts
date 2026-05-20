/**
 * Langfuse observability adapter — sends workflow traces to a self-hosted Langfuse instance.
 *
 * Uses the Langfuse ingestion API (/api/public/ingestion) directly via fetch,
 * with no additional npm dependencies. Events are batched in memory and flushed
 * explicitly or when `flush()` is called.
 *
 * Self-hosted VPS: http://localhost:3030 (PORTS-REGISTRY.md)
 * Auth: Basic auth with LANGFUSE_PUBLIC_KEY:LANGFUSE_SECRET_KEY
 *
 * @module adapters/observability/langfuse-tracer
 */

import type { ObservabilityPort, Span } from '#core/ports/observability.port.js';

/** Configuration for the Langfuse tracer. */
export interface LangfuseTracerConfig {
    readonly secretKey: string;
    readonly publicKey: string;
    /** Base URL of self-hosted Langfuse (e.g. http://localhost:3030). */
    readonly baseUrl: string;
    /** Trace ID for this session (auto-generated if omitted). */
    readonly traceId?: string;
    /** Human-readable trace name shown in Langfuse UI. */
    readonly traceName?: string;
}

/** Extended port with explicit flush control. */
export interface LangfuseTracer extends ObservabilityPort {
    /** Flush buffered events to Langfuse. Silently no-ops if Langfuse is unreachable. */
    flush(): Promise<void>;
}

interface LangfuseEvent {
    readonly id: string;
    readonly timestamp: string;
    readonly type: string;
    readonly body: Record<string, unknown>;
}

/**
 * Create a Langfuse-backed observability tracer.
 *
 * Each tracer instance owns one Langfuse trace. Spans created via `startSpan()`
 * appear as child spans under that trace. Call `flush()` after workflow completion
 * to ensure all events are persisted.
 */
export function createLangfuseTracer(config: LangfuseTracerConfig): LangfuseTracer {
    const {
        secretKey,
        publicKey,
        baseUrl,
        traceId = crypto.randomUUID(),
        traceName = 'chainskills',
    } = config;

    const pending: LangfuseEvent[] = [];
    let traceCreated = false;

    const authHeader = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`;

    function queue(type: string, body: Record<string, unknown>): void {
        pending.push({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type,
            body,
        });
    }

    function ensureTrace(): void {
        if (!traceCreated) {
            traceCreated = true;
            queue('trace-create', {
                id: traceId,
                name: traceName,
                timestamp: new Date().toISOString(),
            });
        }
    }

    return {
        startSpan(name: string, attributes?: Record<string, unknown>): Span {
            ensureTrace();
            const spanId = crypto.randomUUID();
            const startTime = Date.now();

            queue('span-create', {
                id: spanId,
                traceId,
                name,
                startTime: new Date(startTime).toISOString(),
                input: attributes ?? {},
            });

            return {
                id: spanId,
                name,
                startTime,
                end(endAttributes?: Record<string, unknown>): void {
                    queue('span-update', {
                        id: spanId,
                        endTime: new Date().toISOString(),
                        output: endAttributes ?? {},
                    });
                },
            };
        },

        recordMetric(name: string, value: number, tags?: Record<string, string>): void {
            ensureTrace();
            queue('event-create', {
                id: crypto.randomUUID(),
                traceId,
                name,
                metadata: { value, ...(tags ?? {}) },
            });
        },

        async flush(): Promise<void> {
            if (pending.length === 0) return;
            const batch = pending.splice(0);

            try {
                const res = await fetch(`${baseUrl}/api/public/ingestion`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: authHeader,
                    },
                    body: JSON.stringify({ batch }),
                });
                if (!res.ok) {
                    console.warn(`[langfuse] ingestion HTTP ${res.status} — ${batch.length} events dropped`);
                }
            } catch {
                console.warn(`[langfuse] ingestion unreachable — ${batch.length} events dropped`);
            }
        },
    };
}

/**
 * Create a Langfuse tracer from environment variables, or return null if unconfigured.
 *
 * Required env vars: LANGFUSE_SECRET_KEY, LANGFUSE_PUBLIC_KEY
 * Optional: LANGFUSE_BASE_URL (default: http://localhost:3030)
 */
export function createLangfuseTracerFromEnv(
    traceId?: string,
    traceName?: string,
): LangfuseTracer | null {
    const secretKey = process.env['LANGFUSE_SECRET_KEY'];
    const publicKey = process.env['LANGFUSE_PUBLIC_KEY'];
    if (!secretKey || !publicKey) return null;

    return createLangfuseTracer({
        secretKey,
        publicKey,
        baseUrl: process.env['LANGFUSE_BASE_URL'] ?? 'http://localhost:3030',
        traceId,
        traceName,
    });
}
