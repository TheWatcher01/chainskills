/**
 * Context isolator — creates isolated state stores for parallel execution.
 *
 * Each parallel branch or agent in a swarm gets its own isolated copy
 * of the state store. Results are merged back into the parent store
 * after all branches complete.
 *
 * @module core/services/context-isolator
 */

import type { StateStore } from '#core/ports/state-store.port.js';
import { createMemoryStore } from '#adapters/state/memory-store.js';

/** An isolated execution context with its own state store. */
export interface IsolatedContext {
    /** Isolated store — mutations don't affect parent. */
    readonly store: StateStore;
}

/**
 * Create an isolated context from a parent store.
 *
 * Copies all (or selected) variables from the parent into a new store.
 * Mutations in the isolated store do not affect the parent.
 *
 * @param parentStore - The parent state store to copy from.
 * @param selectedVars - Optional list of variable names to copy. If omitted, copies all.
 * @returns An isolated context with its own store.
 */
export function createIsolatedContext(
    parentStore: StateStore,
    selectedVars?: readonly string[],
): IsolatedContext {
    const parentData = parentStore.getAll();
    let initial: Record<string, unknown>;

    if (selectedVars) {
        initial = {};
        for (const key of selectedVars) {
            if (key in parentData) {
                initial[key] = structuredClone(parentData[key]);
            }
        }
    } else {
        initial = structuredClone(parentData);
    }

    return { store: createMemoryStore(initial) };
}

/** Strategy for merging results from multiple branches. */
export type MergeStrategy = 'last-wins' | 'merge-objects' | 'array-collect';

/**
 * Merge results from multiple isolated contexts back into a parent store.
 *
 * @param parentStore - The parent store to merge results into.
 * @param branchResults - Results from each branch (key-value maps).
 * @param strategy - How to handle conflicts between branches.
 */
export function mergeContextResults(
    parentStore: StateStore,
    branchResults: readonly Record<string, unknown>[],
    strategy: MergeStrategy = 'last-wins',
): void {
    const parentData = parentStore.getAll();
    const parentKeys = new Set(Object.keys(parentData));

    switch (strategy) {
        case 'last-wins': {
            for (const result of branchResults) {
                for (const [key, value] of Object.entries(result)) {
                    // Only merge variables that are NEW (not in parent)
                    if (!parentKeys.has(key)) {
                        parentStore.set(key, value);
                    }
                }
            }
            break;
        }
        case 'merge-objects': {
            const merged: Record<string, unknown> = {};
            for (const result of branchResults) {
                for (const [key, value] of Object.entries(result)) {
                    if (!parentKeys.has(key)) {
                        if (key in merged && typeof merged[key] === 'object' && typeof value === 'object') {
                            merged[key] = { ...(merged[key] as Record<string, unknown>), ...(value as Record<string, unknown>) };
                        } else {
                            merged[key] = value;
                        }
                    }
                }
            }
            for (const [key, value] of Object.entries(merged)) {
                parentStore.set(key, value);
            }
            break;
        }
        case 'array-collect': {
            const collected: Record<string, unknown[]> = {};
            for (const result of branchResults) {
                for (const [key, value] of Object.entries(result)) {
                    if (!parentKeys.has(key)) {
                        if (!collected[key]) collected[key] = [];
                        collected[key].push(value);
                    }
                }
            }
            for (const [key, values] of Object.entries(collected)) {
                parentStore.set(key, values.length === 1 ? values[0] : values);
            }
            break;
        }
    }
}

