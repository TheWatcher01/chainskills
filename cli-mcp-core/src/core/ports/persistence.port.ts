/**
 * Persistence port — low-level SQL store abstraction.
 *
 * Wraps a synchronous SQL database (better-sqlite3) behind an interface
 * so that Features 1 (Run History), 3 (Snapshots), and 5 (Learned Rules)
 * share a single database connection.
 *
 * @module core/ports/persistence
 */

/** A single row returned by a query. */
export type Row = Record<string, unknown>;

/**
 * Low-level persistence store for synchronous SQL operations.
 *
 * Implementations: `createSqlitePersistence` (production),
 * in-memory `:memory:` (testing).
 */
export interface PersistenceStore {
    /** Execute a write statement (INSERT, UPDATE, DELETE, DDL). */
    run(sql: string, ...params: unknown[]): void;

    /** Query a single row. Returns `undefined` if no match. */
    get<T = Row>(sql: string, ...params: unknown[]): T | undefined;

    /** Query all matching rows. */
    all<T = Row>(sql: string, ...params: unknown[]): T[];

    /** Close the database connection. */
    close(): void;
}
