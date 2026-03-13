/**
 * Tests for RulesApplicator — filtering, formatting, admissibility checks.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSqlitePersistence } from '#adapters/state/sqlite-persistence.js';
import { createSqliteRulesStore } from '#adapters/state/sqlite-rules-store.js';
import {
    getApplicableRules,
    formatRulesAsContext,
    checkAdmissibility,
} from '#core/services/rules-applicator.js';
import type { PersistenceStore } from '#core/ports/persistence.port.js';
import type { RulesStore } from '#core/ports/rules-store.port.js';

describe('RulesApplicator', () => {
    let persistence: PersistenceStore;
    let rules: RulesStore;

    beforeEach(() => {
        persistence = createSqlitePersistence(':memory:');
        rules = createSqliteRulesStore(persistence);
    });

    // ─── getApplicableRules ─────────────────────────────────

    it('should return workflow-specific and global rules', () => {
        rules.addRule({ workflowName: 'wf-1', ruleType: 'soft', condition: 'c1', action: 'a1' });
        rules.addRule({ ruleType: 'soft', condition: 'global', action: 'ag' }); // global
        rules.addRule({ workflowName: 'wf-2', ruleType: 'soft', condition: 'c2', action: 'a2' });

        const applicable = getApplicableRules(rules, 'wf-1');
        expect(applicable).toHaveLength(2);
        expect(applicable.map((r) => r.condition)).toContain('c1');
        expect(applicable.map((r) => r.condition)).toContain('global');
    });

    // ─── formatRulesAsContext ───────────────────────────────

    it('should format soft rules as context text', () => {
        rules.addRule({
            ruleType: 'soft',
            condition: 'When code uses eval()',
            action: 'Flag as security risk',
            confidence: 0.9,
        });
        rules.addRule({
            ruleType: 'hard',
            condition: 'hard rule',
            action: 'block',
        });

        const allRules = rules.listAll();
        const context = formatRulesAsContext(allRules);

        expect(context).toContain('Learned Rules');
        expect(context).toContain('When code uses eval()');
        expect(context).toContain('Flag as security risk');
        expect(context).toContain('90%');
        // Should NOT include hard rules in context
        expect(context).not.toContain('hard rule');
    });

    it('should return empty string when no soft rules', () => {
        rules.addRule({ ruleType: 'hard', condition: 'c', action: 'a' });
        const allRules = rules.listAll();
        expect(formatRulesAsContext(allRules)).toBe('');
    });

    // ─── checkAdmissibility ─────────────────────────────────

    it('should pass when no hard rules exist', () => {
        rules.addRule({ ruleType: 'soft', condition: 'c', action: 'a' });
        const allRules = rules.listAll();
        const result = checkAdmissibility(allRules, { x: 1 });
        expect(result.allowed).toBe(true);
        expect(result.violations).toHaveLength(0);
    });

    it('should detect violations from hard rules', () => {
        rules.addRule({
            ruleType: 'hard',
            condition: 'When credentials found in source code',
            action: 'Reject immediately',
            confidence: 0.95,
        });

        const allRules = rules.listAll();

        // State that matches the hard rule condition
        const result = checkAdmissibility(allRules, {
            source: 'const credentials = "secret-key"',
            code: 'function authenticate() { return source; }',
        });

        expect(result.allowed).toBe(false);
        expect(result.violations).toHaveLength(1);
    });

    it('should allow when hard rule keywords do not match state', () => {
        rules.addRule({
            ruleType: 'hard',
            condition: 'When database password is hardcoded',
            action: 'Reject',
        });

        const allRules = rules.listAll();

        const result = checkAdmissibility(allRules, {
            code: 'function add(a, b) { return a + b; }',
        });

        expect(result.allowed).toBe(true);
    });
});
