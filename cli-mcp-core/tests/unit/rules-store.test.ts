/**
 * Tests for RulesStore — CRUD, hit tracking, filtering.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSqlitePersistence } from '#adapters/state/sqlite-persistence.js';
import { createSqliteRulesStore } from '#adapters/state/sqlite-rules-store.js';
import type { PersistenceStore } from '#core/ports/persistence.port.js';
import type { RulesStore } from '#core/ports/rules-store.port.js';

describe('RulesStore (SQLite)', () => {
    let persistence: PersistenceStore;
    let rules: RulesStore;

    beforeEach(() => {
        persistence = createSqlitePersistence(':memory:');
        rules = createSqliteRulesStore(persistence);
    });

    it('should add and retrieve a rule', () => {
        const id = rules.addRule({
            workflowName: 'code-review',
            ruleType: 'soft',
            condition: 'When code has no error handling',
            action: 'Suggest adding try-catch blocks',
            source: '@reflect in step-3',
            confidence: 0.8,
        });

        expect(id).toBeGreaterThan(0);

        const list = rules.listAll();
        expect(list).toHaveLength(1);
        expect(list[0]!.condition).toBe('When code has no error handling');
        expect(list[0]!.action).toBe('Suggest adding try-catch blocks');
        expect(list[0]!.confidence).toBe(0.8);
        expect(list[0]!.ruleType).toBe('soft');
    });

    it('should track hit counts', () => {
        const id = rules.addRule({
            ruleType: 'soft',
            condition: 'test condition',
            action: 'test action',
        });

        rules.recordHit(id);
        rules.recordHit(id);
        rules.recordHit(id);

        const list = rules.listAll();
        expect(list[0]!.hitCount).toBe(3);
    });

    it('should get rules for a workflow including global rules', () => {
        rules.addRule({
            workflowName: 'wf-a',
            ruleType: 'soft',
            condition: 'A-specific',
            action: 'do A',
        });
        rules.addRule({
            ruleType: 'soft',
            condition: 'Global rule',
            action: 'do global',
        });
        rules.addRule({
            workflowName: 'wf-b',
            ruleType: 'soft',
            condition: 'B-specific',
            action: 'do B',
        });

        const rulesForA = rules.getRulesForWorkflow('wf-a');
        expect(rulesForA).toHaveLength(2); // A-specific + global
        expect(rulesForA.map((r) => r.condition)).toContain('A-specific');
        expect(rulesForA.map((r) => r.condition)).toContain('Global rule');
    });

    it('should get global rules only', () => {
        rules.addRule({
            ruleType: 'hard',
            condition: 'Global hard rule',
            action: 'block',
        });
        rules.addRule({
            workflowName: 'wf-x',
            ruleType: 'soft',
            condition: 'Specific',
            action: 'advise',
        });

        const global = rules.getGlobalRules();
        expect(global).toHaveLength(1);
        expect(global[0]!.condition).toBe('Global hard rule');
    });

    it('should filter by rule type', () => {
        rules.addRule({ ruleType: 'soft', condition: 'soft one', action: 'a' });
        rules.addRule({ ruleType: 'hard', condition: 'hard one', action: 'b' });
        rules.addRule({ ruleType: 'soft', condition: 'soft two', action: 'c' });

        const soft = rules.listAll({ ruleType: 'soft' });
        expect(soft).toHaveLength(2);

        const hard = rules.listAll({ ruleType: 'hard' });
        expect(hard).toHaveLength(1);
    });

    it('should delete a rule', () => {
        const id = rules.addRule({
            ruleType: 'soft',
            condition: 'to-delete',
            action: 'test',
        });

        expect(rules.listAll()).toHaveLength(1);
        rules.deleteRule(id);
        expect(rules.listAll()).toHaveLength(0);
    });

    it('should order by confidence then hit count', () => {
        rules.addRule({ ruleType: 'soft', condition: 'low', action: 'a', confidence: 0.3 });
        const id = rules.addRule({ ruleType: 'soft', condition: 'medium', action: 'b', confidence: 0.5 });
        rules.addRule({ ruleType: 'soft', condition: 'high', action: 'c', confidence: 0.9 });

        // Add hits to medium rule
        rules.recordHit(id);
        rules.recordHit(id);

        const list = rules.listAll();
        expect(list[0]!.condition).toBe('high');
        // medium and low are next, with medium having more hits
        expect(list[1]!.condition).toBe('medium');
    });
});
