/**
 * Tests for the SQLite persistence adapter.
 *
 * Uses :memory: databases — no disk I/O, no cleanup needed.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createSqlitePersistence } from '../../src/adapters/state/sqlite-persistence.js';
import type { PersistenceStore } from '../../src/core/ports/persistence.port.js';

describe('createSqlitePersistence', () => {
    let store: PersistenceStore;

    afterEach(() => {
        store?.close();
    });

    it('should create an in-memory database', () => {
        store = createSqlitePersistence(':memory:');
        expect(store).toBeDefined();
    });

    it('should apply migrations automatically', () => {
        store = createSqlitePersistence(':memory:');

        // Verify tables exist
        const tables = store.all<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        );
        const tableNames = tables.map((t) => t.name);

        expect(tableNames).toContain('runs');
        expect(tableNames).toContain('run_events');
        expect(tableNames).toContain('snapshots');
        expect(tableNames).toContain('learned_rules');
        expect(tableNames).toContain('_migrations');
    });

    it('should not re-apply migrations on second open', () => {
        store = createSqlitePersistence(':memory:');

        const migrations = store.all<{ version: number }>(
            'SELECT version FROM _migrations',
        );
        expect(migrations).toHaveLength(1);
        expect(migrations[0]!.version).toBe(1);
    });

    it('should insert and query rows', () => {
        store = createSqlitePersistence(':memory:');

        store.run(
            'INSERT INTO runs (id, workflow_name, status, started_at) VALUES (?, ?, ?, ?)',
            'run-1',
            'test-workflow',
            'running',
            new Date().toISOString(),
        );

        const row = store.get<{ id: string; workflow_name: string }>(
            'SELECT id, workflow_name FROM runs WHERE id = ?',
            'run-1',
        );

        expect(row).toBeDefined();
        expect(row!.id).toBe('run-1');
        expect(row!.workflow_name).toBe('test-workflow');
    });

    it('should return undefined for missing rows', () => {
        store = createSqlitePersistence(':memory:');

        const row = store.get('SELECT * FROM runs WHERE id = ?', 'nonexistent');
        expect(row).toBeUndefined();
    });

    it('should return all matching rows', () => {
        store = createSqlitePersistence(':memory:');

        store.run(
            'INSERT INTO runs (id, workflow_name, status, started_at) VALUES (?, ?, ?, ?)',
            'run-1', 'wf-a', 'completed', new Date().toISOString(),
        );
        store.run(
            'INSERT INTO runs (id, workflow_name, status, started_at) VALUES (?, ?, ?, ?)',
            'run-2', 'wf-a', 'failed', new Date().toISOString(),
        );
        store.run(
            'INSERT INTO runs (id, workflow_name, status, started_at) VALUES (?, ?, ?, ?)',
            'run-3', 'wf-b', 'completed', new Date().toISOString(),
        );

        const rows = store.all<{ id: string }>(
            'SELECT id FROM runs WHERE workflow_name = ?',
            'wf-a',
        );
        expect(rows).toHaveLength(2);
    });

    it('should handle JSON storage in text columns', () => {
        store = createSqlitePersistence(':memory:');

        const inputs = JSON.stringify({ target: 'src/', focus: 'security' });
        store.run(
            'INSERT INTO runs (id, workflow_name, status, started_at, inputs) VALUES (?, ?, ?, ?, ?)',
            'run-json', 'test', 'completed', new Date().toISOString(), inputs,
        );

        const row = store.get<{ inputs: string }>(
            'SELECT inputs FROM runs WHERE id = ?',
            'run-json',
        );
        expect(JSON.parse(row!.inputs)).toEqual({ target: 'src/', focus: 'security' });
    });

    it('should support snapshots table', () => {
        store = createSqlitePersistence(':memory:');

        store.run(
            'INSERT INTO runs (id, workflow_name, status, started_at) VALUES (?, ?, ?, ?)',
            'run-snap', 'test', 'running', new Date().toISOString(),
        );

        store.run(
            'INSERT INTO snapshots (run_id, label, step_id, state, created_at) VALUES (?, ?, ?, ?, ?)',
            'run-snap', 'before-deploy', 'step-3', '{"deployed": false}', new Date().toISOString(),
        );

        const snap = store.get<{ label: string; state: string }>(
            'SELECT label, state FROM snapshots WHERE run_id = ? AND label = ?',
            'run-snap', 'before-deploy',
        );
        expect(snap).toBeDefined();
        expect(snap!.label).toBe('before-deploy');
        expect(JSON.parse(snap!.state)).toEqual({ deployed: false });
    });

    it('should support learned_rules table', () => {
        store = createSqlitePersistence(':memory:');

        store.run(
            `INSERT INTO learned_rules (workflow_name, rule_type, condition, action, source, confidence, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            'code-review', 'soft', 'step fails with lint error',
            'add eslint --fix before lint', 'reflection', 0.8,
            new Date().toISOString(), new Date().toISOString(),
        );

        const rules = store.all<{ condition: string; confidence: number }>(
            'SELECT condition, confidence FROM learned_rules WHERE workflow_name = ?',
            'code-review',
        );
        expect(rules).toHaveLength(1);
        expect(rules[0]!.confidence).toBe(0.8);
    });
});
