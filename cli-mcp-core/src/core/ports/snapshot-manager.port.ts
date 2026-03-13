/**
 * Snapshot manager port — save and restore execution state.
 *
 * Snapshots capture the full state store at a point in time,
 * enabling rollback on failure and replay from checkpoints.
 *
 * @module core/ports/snapshot-manager
 */

/** A recorded snapshot of execution state. */
export interface SnapshotRecord {
    readonly id: number;
    readonly runId: string;
    readonly label: string;
    readonly stepId?: string;
    readonly state: Record<string, unknown>;
    readonly createdAt: string;
}

/** Snapshot manager port — save and restore state snapshots. */
export interface SnapshotManager {
    /** Save a snapshot of the current state. Returns the snapshot ID. */
    save(
        runId: string,
        label: string,
        state: Record<string, unknown>,
        stepId?: string,
    ): number;

    /** Load a snapshot by ID. */
    load(id: number): SnapshotRecord | undefined;

    /** Load the most recent snapshot with the given label. */
    loadByLabel(runId: string, label: string): SnapshotRecord | undefined;

    /** List all snapshots for a run. */
    listByRun(runId: string): readonly SnapshotRecord[];
}
