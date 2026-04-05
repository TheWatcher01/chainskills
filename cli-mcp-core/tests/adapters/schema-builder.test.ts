/**
 * Tests for schema-builder — JSON Schema to Zod conversion and validation.
 */

import { describe, it, expect } from 'vitest';
import { buildZodSchema, validateWithSchema } from '#adapters/validation/schema-builder.js';

describe('buildZodSchema', () => {
    it('should build a string schema', () => {
        const result = buildZodSchema({ type: 'string' });
        expect(result.ok).toBe(true);
    });

    it('should build a number schema', () => {
        const result = buildZodSchema({ type: 'number' });
        expect(result.ok).toBe(true);
    });

    it('should build a boolean schema', () => {
        const result = buildZodSchema({ type: 'boolean' });
        expect(result.ok).toBe(true);
    });

    it('should build an object schema with required fields', () => {
        const result = buildZodSchema({
            type: 'object',
            properties: {
                name: { type: 'string', minLength: 1 },
                age: { type: 'number', minimum: 0 },
            },
            required: ['name'],
        });
        expect(result.ok).toBe(true);
    });

    it('should build an array schema', () => {
        const result = buildZodSchema({
            type: 'array',
            items: { type: 'string' },
        });
        expect(result.ok).toBe(true);
    });

    it('should build an integer schema', () => {
        const result = buildZodSchema({ type: 'integer', minimum: 1, maximum: 100 });
        expect(result.ok).toBe(true);
    });

    it('should build a string schema with pattern', () => {
        const result = buildZodSchema({ type: 'string', pattern: '^[a-z]+$' });
        expect(result.ok).toBe(true);
    });
});

describe('validateWithSchema', () => {
    it('should validate a valid string', () => {
        const schema = buildZodSchema({ type: 'string', minLength: 1 });
        expect(schema.ok).toBe(true);
        if (!schema.ok) return;

        const result = validateWithSchema(schema.value, 'hello');
        expect(result.ok).toBe(true);
        expect(result.value).toBe('hello');
    });

    it('should reject an empty string when minLength is 1', () => {
        const schema = buildZodSchema({ type: 'string', minLength: 1 });
        expect(schema.ok).toBe(true);
        if (!schema.ok) return;

        const result = validateWithSchema(schema.value, '');
        expect(result.ok).toBe(false);
    });

    it('should validate a valid object', () => {
        const schema = buildZodSchema({
            type: 'object',
            properties: {
                name: { type: 'string' },
                score: { type: 'number' },
            },
            required: ['name'],
        });
        expect(schema.ok).toBe(true);
        if (!schema.ok) return;

        const result = validateWithSchema(schema.value, { name: 'Alice', score: 42 });
        expect(result.ok).toBe(true);
    });

    it('should reject an object missing a required field', () => {
        const schema = buildZodSchema({
            type: 'object',
            properties: {
                name: { type: 'string' },
            },
            required: ['name'],
        });
        expect(schema.ok).toBe(true);
        if (!schema.ok) return;

        const result = validateWithSchema(schema.value, { age: 25 });
        expect(result.ok).toBe(false);
    });

    it('should parse JSON strings before validation', () => {
        const schema = buildZodSchema({
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
        });
        expect(schema.ok).toBe(true);
        if (!schema.ok) return;

        const result = validateWithSchema(schema.value, '{"name": "Bob"}');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect((result.value as Record<string, unknown>).name).toBe('Bob');
        }
    });

    it('should validate number constraints', () => {
        const schema = buildZodSchema({ type: 'number', minimum: 0, maximum: 100 });
        expect(schema.ok).toBe(true);
        if (!schema.ok) return;

        expect(validateWithSchema(schema.value, 50).ok).toBe(true);
        expect(validateWithSchema(schema.value, -1).ok).toBe(false);
        expect(validateWithSchema(schema.value, 101).ok).toBe(false);
    });

    it('should validate arrays', () => {
        const schema = buildZodSchema({
            type: 'array',
            items: { type: 'number' },
        });
        expect(schema.ok).toBe(true);
        if (!schema.ok) return;

        expect(validateWithSchema(schema.value, [1, 2, 3]).ok).toBe(true);
        expect(validateWithSchema(schema.value, ['a', 'b']).ok).toBe(false);
    });

    it('should validate string patterns', () => {
        const schema = buildZodSchema({ type: 'string', pattern: '^[A-Z]{3}$' });
        expect(schema.ok).toBe(true);
        if (!schema.ok) return;

        expect(validateWithSchema(schema.value, 'ABC').ok).toBe(true);
        expect(validateWithSchema(schema.value, 'abc').ok).toBe(false);
        expect(validateWithSchema(schema.value, 'ABCD').ok).toBe(false);
    });

    it('should allow optional fields in objects', () => {
        const schema = buildZodSchema({
            type: 'object',
            properties: {
                name: { type: 'string' },
                email: { type: 'string' },
            },
            required: ['name'],
        });
        expect(schema.ok).toBe(true);
        if (!schema.ok) return;

        // email is optional
        const result = validateWithSchema(schema.value, { name: 'Alice' });
        expect(result.ok).toBe(true);
    });
});
