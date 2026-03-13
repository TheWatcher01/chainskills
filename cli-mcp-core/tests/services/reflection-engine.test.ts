/**
 * Tests for ReflectionEngine — analysis, rule generation, response parsing.
 */

import { describe, it, expect } from 'vitest';
import { createReflectionEngine } from '#core/services/reflection-engine.js';
import type { AgentProvider } from '#core/ports/agent-provider.port.js';
import { ok, err } from '#infra/errors.js';

/** Mock agent that returns a specific JSON response. */
function mockAgent(response: string): AgentProvider {
    return {
        async invoke() {
            return ok({ content: response });
        },
        has: () => true,
        list: () => ['reflect'],
    };
}

/** Mock agent that fails. */
function failAgent(message: string): AgentProvider {
    return {
        async invoke() {
            return err({ type: 'AGENT_ERROR' as const, message });
        },
        has: () => true,
        list: () => ['reflect'],
    };
}

describe('ReflectionEngine', () => {
    it('should parse a valid reflection response', async () => {
        const agent = mockAgent(JSON.stringify({
            summary: 'Code lacks error handling in 3 functions',
            rules: [
                {
                    ruleType: 'soft',
                    condition: 'When a function calls an external API',
                    action: 'Wrap the call in try-catch',
                    confidence: 0.85,
                },
                {
                    ruleType: 'hard',
                    condition: 'When credentials are in source code',
                    action: 'Reject the code immediately',
                    confidence: 0.95,
                },
            ],
            suggestions: ['Add input validation', 'Use structured logging'],
        }));

        const engine = createReflectionEngine(agent);
        const result = await engine.reflect({
            prompt: 'Analyze this code for issues',
            variables: { code: 'function foo() {}' },
        });

        expect(result.summary).toBe('Code lacks error handling in 3 functions');
        expect(result.rules).toHaveLength(2);
        expect(result.rules[0]!.ruleType).toBe('soft');
        expect(result.rules[0]!.confidence).toBe(0.85);
        expect(result.rules[1]!.ruleType).toBe('hard');
        expect(result.suggestions).toHaveLength(2);
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
        const agent = mockAgent('```json\n' + JSON.stringify({
            summary: 'Found issues',
            rules: [{ ruleType: 'soft', condition: 'c', action: 'a', confidence: 0.5 }],
            suggestions: [],
        }) + '\n```');

        const engine = createReflectionEngine(agent);
        const result = await engine.reflect({
            prompt: 'Analyze',
            variables: {},
        });

        expect(result.summary).toBe('Found issues');
        expect(result.rules).toHaveLength(1);
    });

    it('should handle agent failure gracefully', async () => {
        const agent = failAgent('API key expired');
        const engine = createReflectionEngine(agent);

        const result = await engine.reflect({
            prompt: 'Analyze',
            variables: {},
        });

        expect(result.summary).toContain('Reflection failed');
        expect(result.rules).toHaveLength(0);
    });

    it('should handle malformed JSON response', async () => {
        const agent = mockAgent('This is not JSON at all, just plain text analysis.');
        const engine = createReflectionEngine(agent);

        const result = await engine.reflect({
            prompt: 'Analyze',
            variables: {},
        });

        // Should not crash, should return the text as summary
        expect(result.summary).toBeTruthy();
        expect(result.rules).toHaveLength(0);
    });

    it('should clamp confidence values', async () => {
        const agent = mockAgent(JSON.stringify({
            summary: 'Test',
            rules: [
                { ruleType: 'soft', condition: 'c1', action: 'a1', confidence: 1.5 },
                { ruleType: 'soft', condition: 'c2', action: 'a2', confidence: -0.3 },
            ],
            suggestions: [],
        }));

        const engine = createReflectionEngine(agent);
        const result = await engine.reflect({ prompt: 'x', variables: {} });

        expect(result.rules[0]!.confidence).toBe(1.0);
        expect(result.rules[1]!.confidence).toBe(0);
    });

    it('should filter out rules without condition or action', async () => {
        const agent = mockAgent(JSON.stringify({
            summary: 'Test',
            rules: [
                { ruleType: 'soft', condition: 'valid', action: 'valid' },
                { ruleType: 'soft', condition: '', action: 'no condition' },
                { ruleType: 'soft', action: 'no condition field' },
            ],
            suggestions: [],
        }));

        const engine = createReflectionEngine(agent);
        const result = await engine.reflect({ prompt: 'x', variables: {} });

        expect(result.rules).toHaveLength(1);
        expect(result.rules[0]!.condition).toBe('valid');
    });
});
