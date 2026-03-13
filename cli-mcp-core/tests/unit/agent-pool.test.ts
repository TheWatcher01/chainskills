/**
 * Tests for the agent pool adapter.
 */

import { describe, it, expect } from 'vitest';
import { createAgentPool } from '../../src/adapters/agents/agent-pool.js';
import type { AgentProvider } from '../../src/core/ports/agent-provider.port.js';
import { ok, err } from '../../src/infrastructure/errors.js';

function createMockAgent(delay: number = 10): AgentProvider & { callCount: number } {
    const agent: AgentProvider & { callCount: number } = {
        callCount: 0,
        async invoke(options) {
            agent.callCount++;
            await new Promise((r) => setTimeout(r, delay));
            return ok({
                content: `response for: ${options.prompt.slice(0, 30)}`,
                model: 'mock',
                usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
            });
        },
        has() { return true; },
        list() { return ['copilot']; },
    };
    return agent;
}

describe('AgentPool', () => {
    it('should execute batch with concurrency limit', async () => {
        const agent = createMockAgent(50);
        const pool = createAgentPool(agent, { defaultConcurrency: 2 });

        const tasks = Array.from({ length: 4 }, (_, i) => ({
            id: `task-${i}`,
            agent: 'copilot',
            prompt: `Task ${i}`,
            variables: {},
        }));

        const start = Date.now();
        const results = await pool.executeBatch(tasks, 2);
        const duration = Date.now() - start;

        expect(results).toHaveLength(4);
        expect(results.every((r) => r.result.ok)).toBe(true);

        // With concurrency 2 and 50ms per task: ~100ms minimum (2 batches)
        // Without concurrency (all parallel): ~50ms
        expect(duration).toBeGreaterThanOrEqual(80);
    });

    it('should handle individual task failures', async () => {
        const agent: AgentProvider = {
            async invoke(options) {
                if (options.prompt.includes('fail')) {
                    return err({ code: 'FAIL', message: 'intentional failure' });
                }
                return ok({ content: 'ok', model: 'mock' });
            },
            has() { return true; },
            list() { return ['copilot']; },
        };

        const pool = createAgentPool(agent);

        const results = await pool.executeBatch([
            { id: 'ok-1', agent: 'copilot', prompt: 'do something', variables: {} },
            { id: 'fail-1', agent: 'copilot', prompt: 'fail please', variables: {} },
            { id: 'ok-2', agent: 'copilot', prompt: 'do another', variables: {} },
        ]);

        expect(results).toHaveLength(3);
        expect(results[0]!.result.ok).toBe(true);
        expect(results[1]!.result.ok).toBe(false);
        expect(results[2]!.result.ok).toBe(true);
    });

    it('should timeout individual tasks', async () => {
        const agent = createMockAgent(500); // 500ms delay
        const pool = createAgentPool(agent, { timeout: 50 }); // 50ms timeout

        const results = await pool.executeBatch([
            { id: 'slow', agent: 'copilot', prompt: 'slow task', variables: {} },
        ]);

        expect(results).toHaveLength(1);
        expect(results[0]!.result.ok).toBe(false);
        if (!results[0]!.result.ok) {
            expect(results[0]!.result.error.message).toContain('timed out');
        }
    });

    it('should execute single task via executeOne', async () => {
        const agent = createMockAgent(5);
        const pool = createAgentPool(agent);

        const result = await pool.executeOne({
            id: 'single',
            agent: 'copilot',
            prompt: 'Hello',
            variables: {},
        });

        expect(result.taskId).toBe('single');
        expect(result.result.ok).toBe(true);
        expect(result.durationMs).toBeGreaterThan(0);
    });
});
