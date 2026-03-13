/**
 * SQLite snapshot manager adapter — persists state snapshots in SQLite.
 *
 * @module adapters/state/sqlite-snapshot-manager
 */

import type { PersistenceStore } from '#core/ports/persistence.port.js';
import type {
    SnapshotManager,
    SnapshotRecord,
} from '#core/ports/snapshot-manager.port.js';

/**
 * Create a SQLite-backed `SnapshotManager`.
 *
 * @param persistence - The shared SQLite persistence store.
 * @returns A `SnapshotManager` implementation.
 */
export function createSqliteSnapshotManager(
    persistence: PersistenceStore,
): SnapshotManager {
    return {
        save(
            runId: string,
            label: string,
            state: Record<string, unknown>,
            stepId?: string,
        ): number {
            persistence.run(
                `INSERT INTO snapshots (run_id, label, step_id, state, created_at)
                 VALUES (?, ?, ?, ?, ?)`,
                runId,
                label,
                stepId ?? null,
                JSON.stringify(state),
                new Date().toISOString(),
            );

            const row = persistence.get<{ id: number }>(
                'SELECT last_insert_rowid() as id',
            );
            return row?.id ?? 0;
        },

        load(id: number): SnapshotRecord | undefined {
            const row = persistence.get<{
                id: number;
                run_id: string;
                label: string;
                step_id: string | null;
                state: string;
                created_at: string;
            }>('SELECT * FROM snapshots WHERE id = ?', id);

            if (!row) return undefined;
            return mapRow(row);
        },

        loadByLabel(runId: string, label: string): SnapshotRecord | undefined {
            const row = persistence.get<{
                id: number;
                run_id: string;
                label: string;
                step_id: string | null;
                state: string;
                created_at: string;
            }>(
                'SELECT * FROM snapshots WHERE run_id = ? AND label = ? ORDER BY id DESC LIMIT 1',
                runId,
                label,
            );

            if (!row) return undefined;
            return mapRow(row);
        },

        listByRun(runId: string): readonly SnapshotRecord[] {
            const rows = persistence.all<{
                id: number;
                run_id: string;
                label: string;
                step_id: string | null;
                state: string;
                created_at: string;
            }>(
                'SELECT * FROM snapshots WHERE run_id = ? ORDER BY id',
                runId,
            );

            return rows.map(mapRow);
        },
    };
}

function mapRow(row: {
    id: number;
    run_id: string;
    label: string;
    step_id: string | null;
    state: string;
    created_at: string;
}): SnapshotRecord {
    return {
        id: row.id,
        runId: row.run_id,
        label: row.label,
        stepId: row.step_id ?? undefined,
        state: JSON.parse(row.state),
        createdAt: row.created_at,
    };
}
