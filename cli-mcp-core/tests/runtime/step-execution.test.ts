/**
 * Tests for core services: template-engine and condition-parser.
 */

import { describe, it, expect } from 'vitest';
import {
    substituteVariables,
    extractVariables,
} from '#core/services/template-engine.js';
import { evaluateCondition } from '#core/services/condition-parser.js';

// ─── Template Engine ─────────────────────────────────────────────────────────

describe('substituteVariables', () => {
    it('should replace simple $variable references', () => {
        const result = substituteVariables('Hello $name!', { name: 'World' });
        expect(result).toBe('Hello World!');
    });

    it('should replace braced ${variable} references', () => {
        const result = substituteVariables('Hello ${name}!', { name: 'World' });
        expect(result).toBe('Hello World!');
    });

    it('should handle multiple variables', () => {
        const result = substituteVariables('$greeting $name', {
            greeting: 'Hi',
            name: 'Alice',
        });
        expect(result).toBe('Hi Alice');
    });

    it('should resolve dotted paths like $obj.prop', () => {
        const result = substituteVariables('Email: $user.email', {
            user: { email: 'a@b.c' },
        });
        expect(result).toBe('Email: a@b.c');
    });

    it('should resolve braced dotted paths like ${obj.prop}', () => {
        const result = substituteVariables('${user.email}', {
            user: { email: 'a@b.c' },
        });
        expect(result).toBe('a@b.c');
    });

    it('should leave unresolved variables as-is', () => {
        const result = substituteVariables('$missing stays', {});
        expect(result).toBe('$missing stays');
    });

    it('should handle empty context', () => {
        const result = substituteVariables('$a and $b', {});
        expect(result).toBe('$a and $b');
    });

    it('should handle text with no variables', () => {
        const result = substituteVariables('no vars here', { x: 1 });
        expect(result).toBe('no vars here');
    });

    it('should convert non-string values to string', () => {
        const result = substituteVariables('count: $n', { n: 42 });
        expect(result).toBe('count: 42');
    });

    it('should handle boolean values', () => {
        const result = substituteVariables('flag: $active', { active: true });
        expect(result).toBe('flag: true');
    });
});

describe('extractVariables', () => {
    it('should extract simple variable names', () => {
        const vars = extractVariables('$name and $age');
        expect(vars).toContain('name');
        expect(vars).toContain('age');
    });

    it('should extract braced variable names', () => {
        const vars = extractVariables('${name} and ${age}');
        expect(vars).toContain('name');
        expect(vars).toContain('age');
    });

    it('should extract root from dotted paths', () => {
        const vars = extractVariables('$user.email');
        expect(vars).toContain('user');
        expect(vars).not.toContain('user.email');
    });

    it('should return unique names', () => {
        const vars = extractVariables('$name and $name again');
        expect(vars.filter((v) => v === 'name')).toHaveLength(1);
    });

    it('should return empty array for no variables', () => {
        const vars = extractVariables('no vars');
        expect(vars).toHaveLength(0);
    });
});

// ─── Condition Parser ────────────────────────────────────────────────────────

describe('evaluateCondition', () => {
    it('should evaluate equality: $x == 10', () => {
        const result = evaluateCondition('$x == 10', { x: 10 });
        expect(result.ok && result.value).toBe(true);
    });

    it('should evaluate inequality: $x != 5', () => {
        const result = evaluateCondition('$x != 5', { x: 10 });
        expect(result.ok && result.value).toBe(true);
    });

    it('should evaluate greater than: $score > 50', () => {
        const result = evaluateCondition('$score > 50', { score: 75 });
        expect(result.ok && result.value).toBe(true);
    });

    it('should evaluate less than: $score < 50', () => {
        const result = evaluateCondition('$score < 50', { score: 25 });
        expect(result.ok && result.value).toBe(true);
    });

    it('should evaluate greater-equal: $score >= 50', () => {
        const result = evaluateCondition('$score >= 50', { score: 50 });
        expect(result.ok && result.value).toBe(true);
    });

    it('should evaluate less-equal: $score <= 50', () => {
        const result = evaluateCondition('$score <= 50', { score: 50 });
        expect(result.ok && result.value).toBe(true);
    });

    it('should evaluate boolean equality: $valid == true', () => {
        const result = evaluateCondition('$valid == true', { valid: true });
        expect(result.ok && result.value).toBe(true);
    });

    it('should evaluate string equality with quotes', () => {
        const result = evaluateCondition('$status == "active"', { status: 'active' });
        expect(result.ok && result.value).toBe(true);
    });

    it('should evaluate truthy check: $var', () => {
        const result = evaluateCondition('$flag', { flag: true });
        expect(result.ok && result.value).toBe(true);
    });

    it('should evaluate falsy check: !$var', () => {
        const result = evaluateCondition('!$flag', { flag: false });
        expect(result.ok && result.value).toBe(true);
    });

    it('should evaluate variable vs variable: $a == $b', () => {
        const result = evaluateCondition('$a == $b', { a: 42, b: 42 });
        expect(result.ok && result.value).toBe(true);
    });

    it('should return false for failing conditions', () => {
        const result = evaluateCondition('$x > 100', { x: 50 });
        expect(result.ok && result.value).toBe(false);
    });

    it('should return error for empty expression', () => {
        const result = evaluateCondition('', {});
        expect(result.ok).toBe(false);
    });

    it('should handle undefined variables as falsy', () => {
        const result = evaluateCondition('$missing', {});
        expect(result.ok && result.value).toBe(false);
    });

    it('should handle dotted path: $user.score > 50', () => {
        const result = evaluateCondition('$user.score > 50', {
            user: { score: 80 },
        });
        expect(result.ok && result.value).toBe(true);
    });
});
