/**
 * Run history port — records and queries workflow execution history.
 *
 * Every workflow run is recorded with its events, inputs, outputs,
 * and outcome. Used for debugging, replay, and success rate tracking.
 *
 * @module core/ports/run-history
 */

/** A single recorded workflow run. */
export interface RunRecord {
    readonly id: string;
    readonly workflowName: string;
    readonly workflowPath?: string;
    readonly workflowVersion?: string;
    readonly status: 'running' | 'completed' | 'failed' | 'cancelled';
    readonly startedAt: string;
    readonly endedAt?: string;
    readonly durationMs?: number;
    readonly inputs?: Record<string, unknown>;
    readonly outputs?: Record<string, unknown>;
    readonly error?: string;
}

/** A single recorded execution event within a run. */
export interface RunEventRecord {
    readonly id?: number;
    readonly runId: string;
    readonly eventType: string;
    readonly stepId?: string;
    readonly timestamp: string;
    readonly data?: Record<string, unknown>;
}

/** Run history port — store and query execution records. */
export interface RunHistory {
    /** Start recording a new run. Returns the run ID. */
    startRun(
        workflowName: string,
        inputs?: Record<string, unknown>,
        workflowPath?: string,
        workflowVersion?: string,
    ): string;

    /** Mark a run as completed. */
    endRun(
        runId: string,
        status: 'completed' | 'failed' | 'cancelled',
        outputs?: Record<string, unknown>,
        error?: string,
    ): void;

    /** Record an execution event within a run. */
    recordEvent(
        runId: string,
        eventType: string,
        stepId?: string,
        data?: Record<string, unknown>,
    ): void;

    /** Get a run by ID. */
    getRun(runId: string): RunRecord | undefined;

    /** List runs, optionally filtered by workflow name or status. */
    listRuns(filters?: {
        workflowName?: string;
        status?: string;
        limit?: number;
    }): readonly RunRecord[];

    /** Get all events for a run. */
    getEvents(runId: string): readonly RunEventRecord[];

    /** Get success rate for a workflow. */
    getSuccessRate(workflowName: string): { total: number; success: number; rate: number };
}

/** No-op implementation for when persistence is not configured. */
export function createNoopRunHistory(): RunHistory {
    return {
        startRun() { return `noop-${Date.now()}`; },
        endRun() {},
        recordEvent() {},
        getRun() { return undefined; },
        listRuns() { return []; },
        getEvents() { return []; },
        getSuccessRate() { return { total: 0, success: 0, rate: 0 }; },
    };
}
