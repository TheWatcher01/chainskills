/**
 * Execution controller port — controls workflow execution flow (pause/resume/cancel/step).
 *
 * @module core/ports/execution-controller
 */

export interface ExecutionController {
    /** Pause execution before the next step. */
    pause(): void;

    /** Resume paused execution. */
    resume(): void;

    /** Cancel execution gracefully. */
    cancel(): void;

    /** Execute one step then pause (step-over). */
    step(): void;

    /** Check if execution is currently paused. */
    isPaused(): boolean;

    /** Check if execution has been cancelled. */
    isCancelled(): boolean;

    /** Register listener for pause event. */
    onPaused(listener: () => void): void;

    /** Register listener for resume event. */
    onResumed(listener: () => void): void;
}
