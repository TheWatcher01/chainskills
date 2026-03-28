/**
 * Console-based observability adapter.
 *
 * Logs spans and metrics to the structured logger.
 * Can be replaced with OpenTelemetry or Langfuse without touching core.
 *
 * @module adapters/observability/console-tracer
 */

import type { ObservabilityPort, Span } from '#core/ports/observability.port.js';
import type { Logger } from '#infra/logger.js';

let spanCounter = 0;

function createSpan(name: string, logger: Logger, attributes?: Record<string, unknown>): Span {
    const id = `span-${++spanCounter}-${Date.now()}`;
    const startTime = Date.now();

    logger.debug(`[trace] ${name} started`, { spanId: id, ...attributes });

    return {
        id,
        name,
        startTime,
        end(endAttributes?: Record<string, unknown>) {
            const duration = Date.now() - startTime;
            logger.debug(`[trace] ${name} ended`, {
                spanId: id,
                duration_ms: duration,
                ...endAttributes,
            });
        },
    };
}

/** Create a console-based tracer that logs to the structured logger. */
export function createConsoleTracer(logger: Logger): ObservabilityPort {
    return {
        startSpan(name: string, attributes?: Record<string, unknown>): Span {
            return createSpan(name, logger, attributes);
        },
        recordMetric(name: string, value: number, tags?: Record<string, string>) {
            logger.info(`[metric] ${name}=${value}`, { tags });
        },
    };
}
