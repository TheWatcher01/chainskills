import { describe, it, expect } from 'vitest';
import { classifyFreshness } from '#core/entities/data-provenance.js';

describe('DataProvenance', () => {
    describe('classifyFreshness', () => {
        const now = '2026-03-27T00:00:00Z';

        it('should classify recent data as fresh', () => {
            expect(classifyFreshness('2026-03-01T00:00:00Z', now)).toBe('fresh');
            expect(classifyFreshness('2026-01-01T00:00:00Z', now)).toBe('fresh');
        });

        it('should classify 90-365 day old data as aging', () => {
            expect(classifyFreshness('2025-10-01T00:00:00Z', now)).toBe('aging');
        });

        it('should classify 1-2 year old data as stale', () => {
            expect(classifyFreshness('2024-10-01T00:00:00Z', now)).toBe('stale');
        });

        it('should classify 2+ year old data as expired', () => {
            expect(classifyFreshness('2023-01-01T00:00:00Z', now)).toBe('expired');
        });

        it('should classify invalid dates as unverified', () => {
            expect(classifyFreshness('not-a-date', now)).toBe('unverified');
        });
    });
});
