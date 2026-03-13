/**
 * Execution events port — observable execution progress.
 *
 * Defines a typed event system for workflow execution progress.
 * Consumed by the CLI for streaming output and by adapters for monitoring.
 *
 * Both `SimpleExecutor` and `MastraExecutor` emit these events.
 *
 * @module core/ports/execution-events
 */

// ─── Event Types ─────────────────────────────────────────────────────────────

/** All possible execution event types. */
export type ExecutionEventType =
    | 'workflow:start'
    | 'workflow:end'
    | 'step:start'
    | 'step:end'
    | 'step:skip'
    | 'directive:start'
    | 'directive:end'
    | 'parallel:start'
    | 'parallel:end'
    | 'loop:iteration'
    | 'snapshot:created'
    | 'snapshot:restored'
    | 'reflection:complete'
    | 'validation:passed'
    | 'validation:failed'
    | 'error';

/** Base event shape. */
interface BaseEvent {
    readonly type: ExecutionEventType;
    readonly timestamp: number;
}

/** Emitted when workflow execution begins. */
export interface WorkflowStartEvent extends BaseEvent {
    readonly type: 'workflow:start';
    readonly workflowName: string;
    readonly totalSteps: number;
    readonly dryRun: boolean;
}

/** Emitted when workflow execution completes. */
export interface WorkflowEndEvent extends BaseEvent {
    readonly type: 'workflow:end';
    readonly workflowName: string;
    readonly success: boolean;
    readonly duration: number;
    readonly outputs?: Record<string, unknown>;
}

/** Emitted when a step starts executing. */
export interface StepStartEvent extends BaseEvent {
    readonly type: 'step:start';
    readonly stepId: string;
    readonly stepTitle: string;
    readonly stepIndex: number;
    readonly totalSteps: number;
}

/** Emitted when a step completes. */
export interface StepEndEvent extends BaseEvent {
    readonly type: 'step:end';
    readonly stepId: string;
    readonly success: boolean;
    readonly duration: number;
    readonly error?: string;
}

/** Emitted when a step is skipped (e.g., @if condition false). */
export interface StepSkipEvent extends BaseEvent {
    readonly type: 'step:skip';
    readonly stepId: string;
    readonly reason: string;
}

/** Emitted when a directive starts executing within a step. */
export interface DirectiveStartEvent extends BaseEvent {
    readonly type: 'directive:start';
    readonly stepId: string;
    readonly directiveType: string;
    readonly raw: string;
}

/** Emitted when a directive completes. */
export interface DirectiveEndEvent extends BaseEvent {
    readonly type: 'directive:end';
    readonly stepId: string;
    readonly directiveType: string;
    readonly success: boolean;
    readonly result?: unknown;
}

/** Emitted when parallel execution starts. */
export interface ParallelStartEvent extends BaseEvent {
    readonly type: 'parallel:start';
    readonly stepIds: readonly string[];
}

/** Emitted when parallel execution completes. */
export interface ParallelEndEvent extends BaseEvent {
    readonly type: 'parallel:end';
    readonly results: Record<string, { success: boolean; error?: string }>;
    readonly duration: number;
}

/** Emitted on each loop iteration. */
export interface LoopIterationEvent extends BaseEvent {
    readonly type: 'loop:iteration';
    readonly stepId: string;
    readonly index: number;
    readonly total?: number;
    readonly item?: unknown;
}

/** Emitted on execution errors. */
export interface ErrorEvent extends BaseEvent {
    readonly type: 'error';
    readonly stepId?: string;
    readonly message: string;
    readonly code?: string;
}

/** Emitted when a state snapshot is created. */
export interface SnapshotCreatedEvent extends BaseEvent {
    readonly type: 'snapshot:created';
    readonly stepId: string;
    readonly label: string;
    readonly snapshotId: number;
}

/** Emitted when a state snapshot is restored. */
export interface SnapshotRestoredEvent extends BaseEvent {
    readonly type: 'snapshot:restored';
    readonly stepId: string;
    readonly label: string;
    readonly snapshotId: number;
}

/** Emitted when a reflection analysis completes. */
export interface ReflectionCompleteEvent extends BaseEvent {
    readonly type: 'reflection:complete';
    readonly stepId: string;
    readonly summary: string;
    readonly rulesCount: number;
    readonly suggestionsCount: number;
}

/** Emitted when a @validate check passes. */
export interface ValidationPassedEvent extends BaseEvent {
    readonly type: 'validation:passed';
    readonly stepId: string;
    readonly variable: string;
    readonly schemaName: string;
}

/** Emitted when a @validate check fails. */
export interface ValidationFailedEvent extends BaseEvent {
    readonly type: 'validation:failed';
    readonly stepId: string;
    readonly variable: string;
    readonly schemaName: string;
    readonly issues: readonly string[];
}

/** Union of all execution event types. */
export type ExecutionEvent =
    | WorkflowStartEvent
    | WorkflowEndEvent
    | StepStartEvent
    | StepEndEvent
    | StepSkipEvent
    | DirectiveStartEvent
    | DirectiveEndEvent
    | ParallelStartEvent
    | ParallelEndEvent
    | LoopIterationEvent
    | SnapshotCreatedEvent
    | SnapshotRestoredEvent
    | ReflectionCompleteEvent
    | ValidationPassedEvent
    | ValidationFailedEvent
    | ErrorEvent;

// ─── Event Emitter Interface ─────────────────────────────────────────────────

/** Callback type for execution event handlers. */
export type ExecutionEventHandler = (event: ExecutionEvent) => void;

/**
 * Typed event emitter for workflow execution events.
 *
 * Injected into executors via DI. The CLI subscribes to events for
 * streaming output (spinners, progress bars, etc.).
 */
export interface ExecutionEventEmitter {
    /** Emit an execution event. */
    emit(event: ExecutionEvent): void;
    /** Subscribe to all execution events. */
    on(handler: ExecutionEventHandler): void;
    /** Unsubscribe a handler. */
    off(handler: ExecutionEventHandler): void;
}
