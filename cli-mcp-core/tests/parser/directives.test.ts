/**
 * Tests for directive entity and DirectiveType validation.
 */

import { describe, it, expect } from 'vitest';
import {
    DIRECTIVE_TYPES,
    isDirectiveType,
} from '#core/entities/directive.js';
import type { Directive, DirectiveType } from '#core/entities/directive.js';

describe('DirectiveType', () => {
    const ALL_TYPES: DirectiveType[] = [
        'use',
        'call',
        'if',
        'else',
        'for',
        'repeat',
        'parallel',
        'try',
        'on-error',
        'assert',
        'output',
        'workflow',
        'env',
        'agent',
        'handoff',
    ];

    it('should contain all 15 directive types', () => {
        expect(DIRECTIVE_TYPES.size).toBe(15);
    });

    it.each(ALL_TYPES)('should recognize "%s" as a valid directive type', (type) => {
        expect(isDirectiveType(type)).toBe(true);
        expect(DIRECTIVE_TYPES.has(type)).toBe(true);
    });

    it('should reject unknown directive types', () => {
        expect(isDirectiveType('unknown')).toBe(false);
        expect(isDirectiveType('')).toBe(false);
        expect(isDirectiveType('USE')).toBe(false);
        expect(isDirectiveType('call ')).toBe(false);
    });

    it('should create a valid Directive value object', () => {
        const directive: Directive = {
            type: 'call',
            raw: '@call shell.exec($command) → $result',
            args: { tool: 'shell', method: 'exec', input: '$command', capture: '$result' },
        };

        expect(directive.type).toBe('call');
        expect(directive.raw).toContain('@call');
        expect(directive.args['tool']).toBe('shell');
    });

    it('should create a @use directive', () => {
        const directive: Directive = {
            type: 'use',
            raw: '@use ./skills/code-review.workflow.md',
            args: { ref: './skills/code-review.workflow.md' },
        };

        expect(directive.type).toBe('use');
        expect(directive.args['ref']).toBe('./skills/code-review.workflow.md');
    });

    it('should create a @if directive with condition args', () => {
        const directive: Directive = {
            type: 'if',
            raw: '@if $score > 50:',
            args: { condition: '$score > 50' },
        };

        expect(directive.type).toBe('if');
        expect(directive.args['condition']).toBe('$score > 50');
    });

    it('should create a @for directive with iteration args', () => {
        const directive: Directive = {
            type: 'for',
            raw: '@for $item in $list:',
            args: { variable: '$item', iterable: '$list' },
        };

        expect(directive.type).toBe('for');
        expect(directive.args['variable']).toBe('$item');
    });
});
