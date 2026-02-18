/**
 * Unit tests for StateStore serialization.
 */

import { describe, it, expect } from 'vitest';
import { createMemoryStore } from '#adapters/state/memory-store.js';

describe('StateStore Serialization', () => {
    it('should serialize empty store', () => {
        const store = createMemoryStore();
        const serialized = store.serialize();
        expect(serialized).toBe('[]');
    });

    it('should serialize store with values', () => {
        const store = createMemoryStore({ foo: 'bar', count: 42 });
        const serialized = store.serialize();
        const parsed = JSON.parse(serialized);

        expect(parsed).toEqual(
            expect.arrayContaining([
                ['foo', 'bar'],
                ['count', 42],
            ]),
        );
    });

    it('should deserialize empty store', () => {
        const store = createMemoryStore({ initial: 'value' });
        store.deserialize('[]');

        expect(store.has('initial')).toBe(false);
        expect(Object.keys(store.getAll())).toHaveLength(0);
    });

    it('should deserialize store with values', () => {
        const store = createMemoryStore();
        const data = JSON.stringify([
            ['key1', 'value1'],
            ['key2', 123],
            ['key3', { nested: true }],
        ]);

        store.deserialize(data);

        expect(store.get('key1')).toBe('value1');
        expect(store.get('key2')).toBe(123);
        expect(store.get('key3')).toEqual({ nested: true });
    });

    it('should round-trip serialize and deserialize', () => {
        const store1 = createMemoryStore({
            string: 'test',
            number: 42,
            boolean: true,
            object: { nested: 'value' },
            array: [1, 2, 3],
        });

        const serialized = store1.serialize();

        const store2 = createMemoryStore();
        store2.deserialize(serialized);

        expect(store2.get('string')).toBe('test');
        expect(store2.get('number')).toBe(42);
        expect(store2.get('boolean')).toBe(true);
        expect(store2.get('object')).toEqual({ nested: 'value' });
        expect(store2.get('array')).toEqual([1, 2, 3]);
    });

    it('should clear existing data on deserialize', () => {
        const store = createMemoryStore({ old: 'data' });
        expect(store.has('old')).toBe(true);

        store.deserialize(JSON.stringify([['new', 'data']]));

        expect(store.has('old')).toBe(false);
        expect(store.has('new')).toBe(true);
        expect(store.get('new')).toBe('data');
    });
});
