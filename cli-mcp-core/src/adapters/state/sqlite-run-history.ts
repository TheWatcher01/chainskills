/**
 * SQLite run history adapter — records workflow executions in SQLite.
 *
 * @module adapters/state/sqlite-run-history
 */

import { randomUUID } from 'node:crypto';
import type { PersistenceStore } from '#core/ports/persistence.port.js';
import type {
    RunHistory,
    RunRecord,
    RunEventRecord,
} from '#core/ports/run-history.port.js';

/**
 * Create a SQLite-backed `RunHistory`.
 *
 * @param persistence - The shared SQLite persistence store.
 * @returns A `RunHistory` implementation.
 */
export function createSqliteRunHistory(
    persistence: PersistenceStore,
): RunHistory {
    return {
        startRun(
            workflowName: string,
            inputs?: Record<string, unknown>,
            workflowPath?: string,
            workflowVersion?: string,
        ): string {
            const id = randomUUID();
            const now = new Date().toISOString();

            persistence.run(
                `INSERT INTO runs (id, workflow_name, workflow_path, workflow_version, status, started_at, inputs)
                 VALUES (?, ?, ?, ?, 'running', ?, ?)`,
                id,
                workflowName,
                workflowPath ?? null,
                workflowVersion ?? null,
                now,
                inputs ? JSON.stringify(inputs) : null,
            );

            return id;
        },

        endRun(
            runId: string,
            status: 'completed' | 'failed' | 'cancelled',
            outputs?: Record<string, unknown>,
            error?: string,
        ): void {
            const now = new Date().toISOString();
            const run = persistence.get<{ started_at: string }>(
                'SELECT started_at FROM runs WHERE id = ?',
                runId,
            );

            const durationMs = run
                ? Date.now() - new Date(run.started_at).getTime()
                : 0;

            persistence.run(
                `UPDATE runs SET status = ?, ended_at = ?, duration_ms = ?, outputs = ?, error = ?
                 WHERE id = ?`,
                status,
                now,
                durationMs,
                outputs ? JSON.stringify(outputs) : null,
                error ?? null,
                runId,
            );
        },

        recordEvent(
            runId: string,
            eventType: string,
            stepId?: string,
            data?: Record<string, unknown>,
        ): void {
            persistence.run(
                `INSERT INTO run_events (run_id, event_type, step_id, timestamp, data)
                 VALUES (?, ?, ?, ?, ?)`,
                runId,
                eventType,
                stepId ?? null,
                new Date().toISOString(),
                data ? JSON.stringify(data) : null,
            );
        },

        getRun(runId: string): RunRecord | undefined {
            const row = persistence.get<{
                id: string;
                workflow_name: string;
                workflow_path: string | null;
                workflow_version: string | null;
                status: string;
                started_at: string;
                ended_at: string | null;
                duration_ms: number | null;
                inputs: string | null;
                outputs: string | null;
                error: string | null;
            }>('SELECT * FROM runs WHERE id = ?', runId);

            if (!row) return undefined;

            return mapRowToRecord(row);
        },

        listRuns(filters?: {
            workflowName?: string;
            status?: string;
            limit?: number;
        }): readonly RunRecord[] {
            let sql = 'SELECT * FROM runs';
            const params: unknown[] = [];
            const conditions: string[] = [];

            if (filters?.workflowName) {
                conditions.push('workflow_name = ?');
                params.push(filters.workflowName);
            }
            if (filters?.status) {
                conditions.push('status = ?');
                params.push(filters.status);
            }

            if (conditions.length > 0) {
                sql += ' WHERE ' + conditions.join(' AND ');
            }

            sql += ' ORDER BY started_at DESC';

            if (filters?.limit) {
                sql += ' LIMIT ?';
                params.push(filters.limit);
            }

            const rows = persistence.all<Record<string, unknown>>(sql, ...params);
            return rows.map(mapRowToRecord);
        },

        getEvents(runId: string): readonly RunEventRecord[] {
            const rows = persistence.all<{
                id: number;
                run_id: string;
                event_type: string;
                step_id: string | null;
                timestamp: string;
                data: string | null;
            }>(
                'SELECT * FROM run_events WHERE run_id = ? ORDER BY id',
                runId,
            );

            return rows.map((row) => ({
                id: row.id,
                runId: row.run_id,
                eventType: row.event_type,
                stepId: row.step_id ?? undefined,
                timestamp: row.timestamp,
                data: row.data ? JSON.parse(row.data) : undefined,
            }));
        },

        getSuccessRate(workflowName: string): { total: number; success: number; rate: number } {
            const total = persistence.get<{ count: number }>(
                'SELECT COUNT(*) as count FROM runs WHERE workflow_name = ? AND status != ?',
                workflowName,
                'running',
            );
            const success = persistence.get<{ count: number }>(
                'SELECT COUNT(*) as count FROM runs WHERE workflow_name = ? AND status = ?',
                workflowName,
                'completed',
            );

            const t = total?.count ?? 0;
            const s = success?.count ?? 0;

            return {
                total: t,
                success: s,
                rate: t > 0 ? s / t : 0,
            };
        },
    };
}

function mapRowToRecord(row: Record<string, unknown>): RunRecord {
    return {
        id: String(row['id']),
        workflowName: String(row['workflow_name']),
        workflowPath: row['workflow_path'] ? String(row['workflow_path']) : undefined,
        workflowVersion: row['workflow_version'] ? String(row['workflow_version']) : undefined,
        status: String(row['status']) as RunRecord['status'],
        startedAt: String(row['started_at']),
        endedAt: row['ended_at'] ? String(row['ended_at']) : undefined,
        durationMs: typeof row['duration_ms'] === 'number' ? row['duration_ms'] : undefined,
        inputs: row['inputs'] ? JSON.parse(String(row['inputs'])) : undefined,
        outputs: row['outputs'] ? JSON.parse(String(row['outputs'])) : undefined,
        error: row['error'] ? String(row['error']) : undefined,
    };
}
