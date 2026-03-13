/**
 * SQLite rules store adapter — persists learned rules in SQLite.
 *
 * @module adapters/state/sqlite-rules-store
 */

import type { PersistenceStore } from '#core/ports/persistence.port.js';
import type {
    RulesStore,
    LearnedRule,
} from '#core/ports/rules-store.port.js';

/**
 * Create a SQLite-backed `RulesStore`.
 *
 * @param persistence - The shared SQLite persistence store.
 * @returns A `RulesStore` implementation.
 */
export function createSqliteRulesStore(
    persistence: PersistenceStore,
): RulesStore {
    return {
        addRule(rule): number {
            const now = new Date().toISOString();
            persistence.run(
                `INSERT INTO learned_rules (workflow_name, rule_type, condition, action, source, confidence, hit_count, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
                rule.workflowName ?? null,
                rule.ruleType,
                rule.condition,
                rule.action,
                rule.source ?? null,
                rule.confidence ?? 0.5,
                now,
                now,
            );

            const row = persistence.get<{ id: number }>(
                'SELECT last_insert_rowid() as id',
            );
            return row?.id ?? 0;
        },

        getRulesForWorkflow(workflowName: string): readonly LearnedRule[] {
            const rows = persistence.all<Record<string, unknown>>(
                `SELECT * FROM learned_rules
                 WHERE workflow_name = ? OR workflow_name IS NULL
                 ORDER BY confidence DESC, hit_count DESC`,
                workflowName,
            );
            return rows.map(mapRow);
        },

        getGlobalRules(): readonly LearnedRule[] {
            const rows = persistence.all<Record<string, unknown>>(
                'SELECT * FROM learned_rules WHERE workflow_name IS NULL ORDER BY confidence DESC',
            );
            return rows.map(mapRow);
        },

        recordHit(ruleId: number): void {
            persistence.run(
                `UPDATE learned_rules SET hit_count = hit_count + 1, updated_at = ? WHERE id = ?`,
                new Date().toISOString(),
                ruleId,
            );
        },

        listAll(filters?): readonly LearnedRule[] {
            let sql = 'SELECT * FROM learned_rules';
            const params: unknown[] = [];
            const conditions: string[] = [];

            if (filters?.workflowName) {
                conditions.push('(workflow_name = ? OR workflow_name IS NULL)');
                params.push(filters.workflowName);
            }
            if (filters?.ruleType) {
                conditions.push('rule_type = ?');
                params.push(filters.ruleType);
            }

            if (conditions.length > 0) {
                sql += ' WHERE ' + conditions.join(' AND ');
            }

            sql += ' ORDER BY confidence DESC, hit_count DESC';

            const rows = persistence.all<Record<string, unknown>>(sql, ...params);
            return rows.map(mapRow);
        },

        deleteRule(ruleId: number): void {
            persistence.run('DELETE FROM learned_rules WHERE id = ?', ruleId);
        },
    };
}

function mapRow(row: Record<string, unknown>): LearnedRule {
    return {
        id: Number(row['id']),
        workflowName: row['workflow_name'] ? String(row['workflow_name']) : undefined,
        ruleType: String(row['rule_type']) as 'soft' | 'hard',
        condition: String(row['condition']),
        action: String(row['action']),
        source: row['source'] ? String(row['source']) : undefined,
        confidence: Number(row['confidence'] ?? 0.5),
        hitCount: Number(row['hit_count'] ?? 0),
        createdAt: String(row['created_at']),
        updatedAt: String(row['updated_at']),
    };
}
