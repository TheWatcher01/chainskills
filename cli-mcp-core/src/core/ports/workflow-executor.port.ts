/**
 * Workflow executor port — executes a parsed workflow with given inputs.
 *
 * Implemented by the simple sequential executor (MVP) and later by the
 * Mastra DAG executor (v0.2+).
 *
 * @module core/ports/workflow-executor
 */

import type { Result } from '#infra/errors.js';
import type { ExecutionError } from '#infra/errors.js';
import type { Workflow } from '#core/entities/workflow.js';
import type { ExecutionController } from './execution-controller.port.js';

/** Options for workflow execution. */
export interface ExecutionOptions {
    /** When true, simulate execution without side effects. */
    readonly dryRun?: boolean;
    /** Timeout per step in milliseconds. */
    readonly stepTimeout?: number;
}

/** Result of a single step execution. */
export interface StepResult {
    readonly stepId: string;
    readonly status: 'success' | 'failure' | 'skipped';
    readonly output?: unknown;
    readonly error?: string;
    readonly duration: number;
}

/** Result of a complete workflow execution. */
export interface ExecutionResult {
    readonly outputs: Record<string, unknown>;
    readonly steps: readonly StepResult[];
    readonly duration: number;
    /** Controller for execution flow (pause/resume/cancel). */
    readonly controller: ExecutionController;
}

/**
 * Executes a workflow with provided inputs and options.
 */
export interface WorkflowExecutor {
    /** Execute the workflow, returning step results and final outputs. */
    execute(
        workflow: Workflow,
        inputs: Record<string, unknown>,
        options?: ExecutionOptions,
    ): Promise<Result<ExecutionResult, ExecutionError>>;
}
