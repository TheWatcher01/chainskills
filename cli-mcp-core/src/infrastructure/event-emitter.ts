/**
 * In-process event emitter implementation.
 *
 * Implements the `ExecutionEventEmitter` port interface using a synchronous
 * callback list — no Node.js EventEmitter dependency so the infrastructure
 * stays lightweight.
 *
 * Previously located in `core/ports/execution-events.port.ts` — moved here
 * to respect the hexagonal rule: ports contain interfaces only, never
 * implementations.
 *
 * @module infrastructure/event-emitter
 */

import type {
    ExecutionEvent,
    ExecutionEventHandler,
    ExecutionEventEmitter,
} from '#core/ports/execution-events.port.js';

/**
 * Create a simple in-process event emitter.
 *
 * Uses a synchronous callback list — no Node.js EventEmitter dependency.
 */
export function createEventEmitter(): ExecutionEventEmitter {
    const handlers: ExecutionEventHandler[] = [];

    return {
        emit(event: ExecutionEvent): void {
            for (const handler of handlers) {
                handler(event);
            }
        },
        on(handler: ExecutionEventHandler): void {
            handlers.push(handler);
        },
        off(handler: ExecutionEventHandler): void {
            const idx = handlers.indexOf(handler);
            if (idx >= 0) handlers.splice(idx, 1);
        },
    };
}
