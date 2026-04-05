/**
 * Tests for logical operators (&&, ||) in condition parser.
 */

import { describe, it, expect } from 'vitest';
import { evaluateCondition } from '#core/services/condition-parser.js';

describe('Condition Parser — Logical Operators', () => {
    // ─── AND (&&) ────────────────────────────────────────────────────

    it('should evaluate simple AND: both true', () => {
        const result = evaluateCondition('$a == 1 && $b == 2', { a: 1, b: 2 });
        expect(result.ok).toBe(true);
        expect(result.value).toBe(true);
    });

    it('should evaluate simple AND: left false (short-circuit)', () => {
        const result = evaluateCondition('$a == 99 && $b == 2', { a: 1, b: 2 });
        expect(result.ok).toBe(true);
        expect(result.value).toBe(false);
    });

    it('should evaluate simple AND: right false', () => {
        const result = evaluateCondition('$a == 1 && $b == 99', { a: 1, b: 2 });
        expect(result.ok).toBe(true);
        expect(result.value).toBe(false);
    });

    it('should evaluate triple AND', () => {
        const result = evaluateCondition('$a > 0 && $b > 0 && $c > 0', { a: 1, b: 2, c: 3 });
        expect(result.ok).toBe(true);
        expect(result.value).toBe(true);
    });

    // ─── OR (||) ─────────────────────────────────────────────────────

    it('should evaluate simple OR: first true (short-circuit)', () => {
        const result = evaluateCondition('$a == 1 || $b == 99', { a: 1, b: 2 });
        expect(result.ok).toBe(true);
        expect(result.value).toBe(true);
    });

    it('should evaluate simple OR: second true', () => {
        const result = evaluateCondition('$a == 99 || $b == 2', { a: 1, b: 2 });
        expect(result.ok).toBe(true);
        expect(result.value).toBe(true);
    });

    it('should evaluate OR: both false', () => {
        const result = evaluateCondition('$a == 99 || $b == 99', { a: 1, b: 2 });
        expect(result.ok).toBe(true);
        expect(result.value).toBe(false);
    });

    // ─── Mixed && and || ────────────────────────────────────────────

    it('should respect precedence: && binds tighter than ||', () => {
        // $a == 1 || $b == 99 && $c == 99
        // Should be: $a == 1 || ($b == 99 && $c == 99)
        // = true || false = true
        const result = evaluateCondition('$a == 1 || $b == 99 && $c == 99', { a: 1, b: 2, c: 3 });
        expect(result.ok).toBe(true);
        expect(result.value).toBe(true);
    });

    it('should handle mixed: false || true && true', () => {
        const result = evaluateCondition('$a == 99 || $b == 2 && $c == 3', { a: 1, b: 2, c: 3 });
        expect(result.ok).toBe(true);
        expect(result.value).toBe(true);
    });

    // ─── With truthy checks ─────────────────────────────────────────

    it('should combine truthy checks with &&', () => {
        const result = evaluateCondition('$valid && $score > 50', { valid: true, score: 75 });
        expect(result.ok).toBe(true);
        expect(result.value).toBe(true);
    });

    it('should combine falsy truthy with &&', () => {
        const result = evaluateCondition('$valid && $score > 50', { valid: false, score: 75 });
        expect(result.ok).toBe(true);
        expect(result.value).toBe(false);
    });

    // ─── With string comparisons ────────────────────────────────────

    it('should handle string equality in logical expressions', () => {
        const result = evaluateCondition('$status == "active" && $role == "admin"', {
            status: 'active',
            role: 'admin',
        });
        expect(result.ok).toBe(true);
        expect(result.value).toBe(true);
    });

    it('should handle string OR', () => {
        const result = evaluateCondition('$status == "active" || $status == "pending"', {
            status: 'pending',
        });
        expect(result.ok).toBe(true);
        expect(result.value).toBe(true);
    });
});
