/**
 * In-memory state store adapter.
 *
 * Simple `Map`-backed implementation of the `StateStore` port.
 * Used for development and testing. Production alternatives: SQLite, Redis.
 *
 * @module adapters/state/memory-store
 */

import type { StateStore } from '#core/ports/state-store.port.js';

/**
 * Create an in-memory `StateStore`.
 *
 * @param initial - Optional initial key-value pairs.
 * @returns A `StateStore` backed by a `Map`.
 */
export function createMemoryStore(
    initial?: Record<string, unknown>,
): StateStore {
    const store = new Map<string, unknown>(
        initial ? Object.entries(initial) : [],
    );

    return {
        get<T = unknown>(key: string): T | undefined {
            return store.get(key) as T | undefined;
        },

        set(key: string, value: unknown): void {
            store.set(key, value);
        },

        has(key: string): boolean {
            return store.has(key);
        },

        delete(key: string): void {
            store.delete(key);
        },

        getAll(): Record<string, unknown> {
            return Object.fromEntries(store);
        },

        clear(): void {
            store.clear();
        },
    };
}
