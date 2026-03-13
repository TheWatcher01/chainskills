/**
 * Agent pool port — concurrent agent task execution.
 *
 * Manages parallel execution of agent tasks with concurrency limits
 * and per-task context isolation.
 *
 * @module core/ports/agent-pool
 */

import type { Result } from '#infra/errors.js';
import type { AgentResult, AgentError } from '#core/ports/agent-provider.port.js';

/** A single task for an agent to execute. */
export interface AgentTask {
    readonly id: string;
    readonly agent: string;
    readonly prompt: string;
    readonly variables: Record<string, unknown>;
    readonly systemPrompt?: string;
}

/** Result of a single agent task execution. */
export interface AgentTaskResult {
    readonly taskId: string;
    readonly result: Result<AgentResult, AgentError>;
    readonly durationMs: number;
}

/** Pool for executing agent tasks concurrently. */
export interface AgentPool {
    /** Execute multiple agent tasks concurrently with concurrency limit. */
    executeBatch(
        tasks: readonly AgentTask[],
        concurrency?: number,
    ): Promise<readonly AgentTaskResult[]>;

    /** Execute a single task (convenience wrapper). */
    executeOne(task: AgentTask): Promise<AgentTaskResult>;
}
