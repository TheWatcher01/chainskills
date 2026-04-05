/**
 * TraceRecorder — listens to execution events and builds ExecutionTrace records.
 *
 * Wired into the executor via the emitter. After execution completes,
 * call `finalize()` to flush all traces to the TraceStore.
 *
 * @module adapters/executor/trace-recorder
 */

import { createTrace, type ExecutionTrace } from '#core/entities/execution-trace.js';
import type { TraceStore } from '#core/ports/trace-store.port.js';
import type {
    ExecutionEvent,
    ExecutionEventHandler,
    DirectiveStartEvent,
} from '#core/ports/execution-events.port.js';

export class TraceRecorder {
    private readonly pendingStarts = new Map<string, DirectiveStartEvent>();
    private readonly traces: ExecutionTrace[] = [];

    constructor(
        private readonly store: TraceStore,
        private readonly runId: string,
        private readonly workflowName: string,
    ) {}

    /** Event listener — attach to emitter via `emitter.on(recorder.listener)`. */
    readonly listener: ExecutionEventHandler = (event: ExecutionEvent) => {
        switch (event.type) {
            case 'directive:start': {
                // Key by stepId + directiveType to handle nested directives
                const key = `${event.stepId}:${event.directiveType}`;
                this.pendingStarts.set(key, event);
                break;
            }

            case 'directive:end': {
                const key = `${event.stepId}:${event.directiveType}`;
                const start = this.pendingStarts.get(key);
                this.pendingStarts.delete(key);

                const trace = createTrace({
                    run_id: this.runId,
                    workflow_name: this.workflowName,
                    step_id: event.stepId,
                    directive_type: event.directiveType,
                    duration_ms: start
                        ? event.timestamp - start.timestamp
                        : 0,
                    status: event.success ? 'ok' : 'error',
                    input: start?.raw ?? '',
                    output: event.result !== undefined
                        ? typeof event.result === 'string'
                            ? event.result
                            : JSON.stringify(event.result)
                        : '',
                });

                this.traces.push(trace);
                break;
            }
        }
    };

    /** Flush all recorded traces to the TraceStore. */
    async finalize(): Promise<void> {
        for (const trace of this.traces) {
            this.store.append(trace);
        }
        await this.store.flush();
    }

    /** Get the number of recorded traces (useful for testing). */
    get traceCount(): number {
        return this.traces.length;
    }
}
