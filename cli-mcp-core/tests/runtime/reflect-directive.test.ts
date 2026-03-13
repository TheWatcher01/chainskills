/**
 * Tests for @reflect directive — end-to-end reflection and rule injection.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSqlitePersistence } from '#adapters/state/sqlite-persistence.js';
import { createSqliteRulesStore } from '#adapters/state/sqlite-rules-store.js';
import { createReflectionEngine } from '#core/services/reflection-engine.js';
import { executeDirective, type DirectiveHandlerContext } from '#adapters/executor/directive-handlers.js';
import { createMemoryStore } from '#adapters/state/memory-store.js';
import type { PersistenceStore } from '#core/ports/persistence.port.js';
import type { RulesStore } from '#core/ports/rules-store.port.js';
import type { Directive } from '#core/entities/directive.js';
import type { Step } from '#core/entities/step.js';
import type { AgentProvider } from '#core/ports/agent-provider.port.js';
import { ok } from '#infra/errors.js';

const noopTools = {
    call: async () => ({ success: true, output: '' }),
    list: async () => [],
};

function makeStep(directives: Directive[]): Step {
    return { id: 'reflect-step', title: 'Reflect', description: '', directives };
}

/** Mock agent that returns a reflection response. */
function mockReflectAgent(response: Record<string, unknown>): AgentProvider {
    return {
        async invoke() {
            return ok({ content: JSON.stringify(response) });
        },
        has: () => true,
        list: () => ['reflect'],
    };
}

describe('@reflect directive', () => {
    let persistence: PersistenceStore;
    let rulesStore: RulesStore;

    beforeEach(() => {
        persistence = createSqlitePersistence(':memory:');
        rulesStore = createSqliteRulesStore(persistence);
    });

    it('should call reflection engine and store summary', async () => {
        const agent = mockReflectAgent({
            summary: 'Code quality is good, minor issues found',
            rules: [],
            suggestions: ['Add more tests'],
        });

        const store = createMemoryStore();
        store.set('code', 'function add(a, b) { return a + b; }');

        const reflectionEngine = createReflectionEngine(agent);

        const directive: Directive = {
            type: 'reflect',
            raw: '@reflect: "Analyze code quality" → $analysis',
            args: { prompt: 'Analyze code quality', capture: 'analysis' },
        };

        const step = makeStep([directive]);
        const ctx: DirectiveHandlerContext = {
            store,
            tools: noopTools,
            dryRun: false,
            stepId: 'reflect-step',
            reflectionEngine,
            rulesStore,
            workflowName: 'test-wf',
        };

        await executeDirective(directive, step, ctx, {
            executeChildDirectives: async () => {},
        });

        expect(store.get('analysis')).toBe('Code quality is good, minor issues found');
    });

    it('should save learned rules to the rules store', async () => {
        const agent = mockReflectAgent({
            summary: 'Found patterns',
            rules: [
                {
                    ruleType: 'soft',
                    condition: 'When function has no return type',
                    action: 'Add explicit return type annotation',
                    confidence: 0.75,
                },
                {
                    ruleType: 'hard',
                    condition: 'When eval() is used',
                    action: 'Block execution',
                    confidence: 0.95,
                },
            ],
            suggestions: [],
        });

        const store = createMemoryStore();
        const reflectionEngine = createReflectionEngine(agent);

        const directive: Directive = {
            type: 'reflect',
            raw: '@reflect: "Find patterns"',
            args: { prompt: 'Find patterns' },
        };

        const step = makeStep([directive]);
        const ctx: DirectiveHandlerContext = {
            store,
            tools: noopTools,
            dryRun: false,
            stepId: 'reflect-step',
            reflectionEngine,
            rulesStore,
            workflowName: 'pattern-wf',
        };

        await executeDirective(directive, step, ctx, {
            executeChildDirectives: async () => {},
        });

        const allRules = rulesStore.listAll();
        expect(allRules).toHaveLength(2);
        expect(allRules[0]!.condition).toContain('eval()');
        expect(allRules[0]!.ruleType).toBe('hard');
        expect(allRules[1]!.condition).toContain('return type');
        expect(allRules[1]!.ruleType).toBe('soft');
    });

    it('should skip in dry run mode', async () => {
        const agent = mockReflectAgent({ summary: 'Should not be called', rules: [], suggestions: [] });
        const store = createMemoryStore();
        const reflectionEngine = createReflectionEngine(agent);

        const directive: Directive = {
            type: 'reflect',
            raw: '@reflect: "test"',
            args: { prompt: 'test', capture: 'result' },
        };

        const step = makeStep([directive]);
        const ctx: DirectiveHandlerContext = {
            store,
            tools: noopTools,
            dryRun: true,
            stepId: 'reflect-step',
            reflectionEngine,
            rulesStore,
        };

        await executeDirective(directive, step, ctx, {
            executeChildDirectives: async () => {},
        });

        expect(store.get('result')).toBe('[dry-run] reflection skipped');
        expect(rulesStore.listAll()).toHaveLength(0);
    });

    it('should continue gracefully without reflection engine', async () => {
        const store = createMemoryStore();

        const directive: Directive = {
            type: 'reflect',
            raw: '@reflect: "test"',
            args: { prompt: 'test' },
        };

        const step = makeStep([directive]);
        const ctx: DirectiveHandlerContext = {
            store,
            tools: noopTools,
            dryRun: false,
            stepId: 'reflect-step',
            // No reflectionEngine provided
        };

        // Should not throw
        await executeDirective(directive, step, ctx, {
            executeChildDirectives: async () => {},
        });
    });
});
