/**
 * Agent pool adapter — concurrent agent task execution with semaphore.
 *
 * Implements batched execution of agent tasks with configurable
 * concurrency limits and per-task timeouts.
 *
 * @module adapters/agents/agent-pool
 */

import type { AgentProvider } from '#core/ports/agent-provider.port.js';
import type { AgentPool, AgentTask, AgentTaskResult } from '#core/ports/agent-pool.port.js';
import { err } from '#infra/errors.js';

// ─── Semaphore ──────────────────────────────────────────────────────────────

/** Simple counting semaphore for concurrency control. */
function createSemaphore(maxConcurrency: number) {
    let current = 0;
    const queue: Array<() => void> = [];

    return {
        async acquire(): Promise<void> {
            if (current < maxConcurrency) {
                current++;
                return;
            }
            return new Promise<void>((resolve) => {
                queue.push(resolve);
            });
        },
        release(): void {
            current--;
            const next = queue.shift();
            if (next) {
                current++;
                next();
            }
        },
    };
}

// ─── Factory ────────────────────────────────────────────────────────────────

export interface AgentPoolOptions {
    readonly defaultConcurrency?: number;
    readonly timeout?: number;
}

/**
 * Create an `AgentPool` backed by an `AgentProvider`.
 *
 * @param agent - The underlying agent provider for invoking tasks.
 * @param options - Pool configuration.
 * @returns An `AgentPool` instance.
 */
export function createAgentPool(
    agent: AgentProvider,
    options?: AgentPoolOptions,
): AgentPool {
    const defaultConcurrency = options?.defaultConcurrency ?? 5;
    const timeout = options?.timeout ?? 120_000; // 2 minutes default

    return {
        async executeBatch(
            tasks: readonly AgentTask[],
            concurrency?: number,
        ): Promise<readonly AgentTaskResult[]> {
            const sem = createSemaphore(concurrency ?? defaultConcurrency);

            const promises = tasks.map(async (task): Promise<AgentTaskResult> => {
                await sem.acquire();
                const start = Date.now();

                try {
                    const result = await Promise.race([
                        agent.invoke({
                            agent: task.agent,
                            prompt: task.prompt,
                            variables: task.variables,
                            systemPrompt: task.systemPrompt,
                        }),
                        new Promise<never>((_, reject) =>
                            setTimeout(
                                () => reject(new Error(`Agent task ${task.id} timed out after ${timeout}ms`)),
                                timeout,
                            ),
                        ),
                    ]);

                    return {
                        taskId: task.id,
                        result,
                        durationMs: Date.now() - start,
                    };
                } catch (e) {
                    return {
                        taskId: task.id,
                        result: err({
                            code: 'AGENT_TASK_ERROR',
                            message: e instanceof Error ? e.message : String(e),
                        }),
                        durationMs: Date.now() - start,
                    };
                } finally {
                    sem.release();
                }
            });

            return Promise.all(promises);
        },

        async executeOne(task: AgentTask): Promise<AgentTaskResult> {
            const results = await this.executeBatch([task], 1);
            return results[0]!;
        },
    };
}
