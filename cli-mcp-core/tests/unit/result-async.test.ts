import { describe, it, expect } from 'vitest';
import { tryAsync, allOk, ok, err } from '#infra/errors.js';

describe('tryAsync', () => {
    it('should wrap a successful promise in Ok', async () => {
        const result = await tryAsync(
            () => Promise.resolve(42),
            (e) => String(e),
        );
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toBe(42);
    });

    it('should wrap a rejected promise in Err', async () => {
        const result = await tryAsync(
            () => Promise.reject(new Error('fail')),
            (e) => (e instanceof Error ? e.message : 'unknown'),
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toBe('fail');
    });

    it('should catch thrown errors', async () => {
        const result = await tryAsync(
            async () => { throw new Error('boom'); },
            (e) => (e instanceof Error ? e.message : 'unknown'),
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toBe('boom');
    });
});

describe('allOk', () => {
    it('should collect all Ok values into an array', () => {
        const results = [ok(1), ok(2), ok(3)];
        const combined = allOk(results);
        expect(combined.ok).toBe(true);
        if (combined.ok) expect(combined.value).toEqual([1, 2, 3]);
    });

    it('should return first Err encountered', () => {
        const results = [ok(1), err('bad'), ok(3)];
        const combined = allOk(results);
        expect(combined.ok).toBe(false);
        if (!combined.ok) expect(combined.error).toBe('bad');
    });

    it('should handle empty array', () => {
        const combined = allOk([]);
        expect(combined.ok).toBe(true);
        if (combined.ok) expect(combined.value).toEqual([]);
    });
});
