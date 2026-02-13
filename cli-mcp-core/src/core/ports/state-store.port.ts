/**
 * State store port — key-value store for inter-step state propagation.
 *
 * Implemented by `memory-store` (MVP), `sqlite-store` and `redis-store` (later).
 *
 * @module core/ports/state-store
 */

/**
 * A key-value store for workflow execution state.
 *
 * Variables set in one step are available to subsequent steps.
 * Implementations must be synchronous for in-process stores.
 */
export interface StateStore {
    /** Retrieve a value by key. Returns `undefined` if not set. */
    get<T = unknown>(key: string): T | undefined;

    /** Set a value by key. */
    set(key: string, value: unknown): void;

    /** Check whether a key exists. */
    has(key: string): boolean;

    /** Delete a key. */
    delete(key: string): void;

    /** Return all stored key-value pairs as a plain object. */
    getAll(): Record<string, unknown>;

    /** Remove all entries. */
    clear(): void;
}
