/**
 * Tests for the context isolator service.
 */

import { describe, it, expect } from 'vitest';
import {
    createIsolatedContext,
    mergeContextResults,
} from '../../src/core/services/context-isolator.js';
import { createMemoryStore } from '../../src/adapters/state/memory-store.js';

describe('createIsolatedContext', () => {
    it('should create isolated store with all variables', () => {
        const parent = createMemoryStore({ a: 1, b: 'hello', c: true });
        const isolated = createIsolatedContext(parent);

        expect(isolated.store.get('a')).toBe(1);
        expect(isolated.store.get('b')).toBe('hello');
        expect(isolated.store.get('c')).toBe(true);
    });

    it('should create isolated store with selected variables', () => {
        const parent = createMemoryStore({ a: 1, b: 'hello', c: true });
        const isolated = createIsolatedContext(parent, ['a', 'c']);

        expect(isolated.store.get('a')).toBe(1);
        expect(isolated.store.get('b')).toBeUndefined();
        expect(isolated.store.get('c')).toBe(true);
    });

    it('should not leak mutations back to parent', () => {
        const parent = createMemoryStore({ x: 'original' });
        const isolated = createIsolatedContext(parent);

        isolated.store.set('x', 'modified');
        isolated.store.set('new_var', 'new_value');

        expect(parent.get('x')).toBe('original');
        expect(parent.has('new_var')).toBe(false);
    });

    it('should deep-clone objects to prevent reference leaks', () => {
        const obj = { nested: { value: 42 } };
        const parent = createMemoryStore({ obj });
        const isolated = createIsolatedContext(parent);

        const cloned = isolated.store.get('obj') as typeof obj;
        cloned.nested.value = 999;

        expect((parent.get('obj') as typeof obj).nested.value).toBe(42);
    });
});

describe('mergeContextResults', () => {
    it('should merge results with last-wins strategy', () => {
        const parent = createMemoryStore({ input: 'keep' });

        mergeContextResults(parent, [
            { input: 'keep', result_a: 'a' },
            { input: 'keep', result_b: 'b' },
        ], 'last-wins');

        expect(parent.get('input')).toBe('keep');
        expect(parent.get('result_a')).toBe('a');
        expect(parent.get('result_b')).toBe('b');
    });

    it('should merge results with merge-objects strategy', () => {
        const parent = createMemoryStore();

        mergeContextResults(parent, [
            { data: { a: 1 } },
            { data: { b: 2 } },
        ], 'merge-objects');

        const data = parent.get('data') as Record<string, number>;
        expect(data).toEqual({ a: 1, b: 2 });
    });

    it('should merge results with array-collect strategy', () => {
        const parent = createMemoryStore();

        mergeContextResults(parent, [
            { result: 'value-1' },
            { result: 'value-2' },
            { result: 'value-3' },
        ], 'array-collect');

        const result = parent.get('result');
        expect(result).toEqual(['value-1', 'value-2', 'value-3']);
    });

    it('should not overwrite parent variables with unchanged copies', () => {
        const parent = createMemoryStore({ input: 'original', counter: 0 });

        mergeContextResults(parent, [
            { input: 'original', counter: 0, new_var: 'hello' },
        ], 'last-wins');

        expect(parent.get('input')).toBe('original');
        expect(parent.get('new_var')).toBe('hello');
    });
});
