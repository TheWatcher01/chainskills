/**
 * SQLite persistence adapter — shared database for run history, snapshots, and rules.
 *
 * Uses `better-sqlite3` for synchronous, zero-config SQLite access.
 * Defaults to `.chainskills/chainskills.db` in the current working directory.
 * Applies migrations automatically on first connection.
 *
 * @module adapters/state/sqlite-persistence
 */

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { PersistenceStore, Row } from '#core/ports/persistence.port.js';

// ─── Migrations ─────────────────────────────────────────────────────────────

/** A single migration with version number and SQL. */
interface Migration {
    readonly version: number;
    readonly sql: string;
}

const MIGRATIONS: readonly Migration[] = [
    {
        version: 1,
        sql: `
            -- Run history
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                workflow_name TEXT NOT NULL,
                workflow_path TEXT,
                workflow_version TEXT,
                status TEXT NOT NULL DEFAULT 'running',
                started_at TEXT NOT NULL,
                ended_at TEXT,
                duration_ms INTEGER,
                inputs TEXT,
                outputs TEXT,
                error TEXT
            );

            CREATE TABLE IF NOT EXISTS run_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
                event_type TEXT NOT NULL,
                step_id TEXT,
                timestamp TEXT NOT NULL,
                data TEXT,
                FOREIGN KEY (run_id) REFERENCES runs(id)
            );

            CREATE INDEX IF NOT EXISTS idx_run_events_run_id ON run_events(run_id);
            CREATE INDEX IF NOT EXISTS idx_runs_workflow ON runs(workflow_name);

            -- Snapshots
            CREATE TABLE IF NOT EXISTS snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                label TEXT NOT NULL,
                step_id TEXT,
                state TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (run_id) REFERENCES runs(id)
            );

            CREATE INDEX IF NOT EXISTS idx_snapshots_run ON snapshots(run_id);
            CREATE INDEX IF NOT EXISTS idx_snapshots_label ON snapshots(label);

            -- Learned rules
            CREATE TABLE IF NOT EXISTS learned_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workflow_name TEXT,
                rule_type TEXT NOT NULL DEFAULT 'soft',
                condition TEXT NOT NULL,
                action TEXT NOT NULL,
                source TEXT,
                confidence REAL DEFAULT 0.5,
                hit_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_rules_workflow ON learned_rules(workflow_name);
        `,
    },
];

// ─── Migration Runner ───────────────────────────────────────────────────────

function applyMigrations(db: Database.Database): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );
    `);

    const applied = db
        .prepare('SELECT version FROM _migrations ORDER BY version')
        .all() as Array<{ version: number }>;

    const appliedSet = new Set(applied.map((r) => r.version));

    for (const migration of MIGRATIONS) {
        if (appliedSet.has(migration.version)) continue;

        db.exec(migration.sql);
        db.prepare('INSERT INTO _migrations (version, applied_at) VALUES (?, ?)').run(
            migration.version,
            new Date().toISOString(),
        );
    }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a SQLite-backed `PersistenceStore`.
 *
 * @param dbPath - Path to the database file. Defaults to `.chainskills/chainskills.db`.
 *                 Use `:memory:` for testing.
 * @returns A `PersistenceStore` backed by SQLite.
 */
export function createSqlitePersistence(
    dbPath?: string,
): PersistenceStore {
    const resolvedPath = dbPath ?? resolve(process.cwd(), '.chainskills', 'chainskills.db');

    // Ensure directory exists (skip for :memory:)
    if (resolvedPath !== ':memory:') {
        const dir = dirname(resolvedPath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
    }

    const db = new Database(resolvedPath);

    // Performance pragmas
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Apply migrations
    applyMigrations(db);

    return {
        run(sql: string, ...params: unknown[]): void {
            db.prepare(sql).run(...params);
        },

        get<T = Row>(sql: string, ...params: unknown[]): T | undefined {
            return db.prepare(sql).get(...params) as T | undefined;
        },

        all<T = Row>(sql: string, ...params: unknown[]): T[] {
            return db.prepare(sql).all(...params) as T[];
        },

        close(): void {
            db.close();
        },
    };
}
