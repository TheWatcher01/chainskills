/**
 * Tests for the schema validator service.
 */

import { describe, it, expect } from 'vitest';
import { createSchemaValidator } from '../../src/core/services/schema-validator.js';
import type { SchemaDefinition } from '../../src/core/ports/schema-validator.port.js';

const validator = createSchemaValidator();

describe('Schema Validator', () => {
    describe('string validation', () => {
        const schema: SchemaDefinition = { type: 'string' };

        it('should pass valid strings', () => {
            expect(validator.validate('hello', schema)).toHaveLength(0);
        });

        it('should fail non-strings', () => {
            const issues = validator.validate(42, schema);
            expect(issues).toHaveLength(1);
            expect(issues[0]!.message).toContain('Expected string');
        });

        it('should validate minLength', () => {
            const s: SchemaDefinition = { type: 'string', minLength: 5 };
            expect(validator.validate('hi', s)).toHaveLength(1);
            expect(validator.validate('hello', s)).toHaveLength(0);
        });

        it('should validate maxLength', () => {
            const s: SchemaDefinition = { type: 'string', maxLength: 3 };
            expect(validator.validate('hi', s)).toHaveLength(0);
            expect(validator.validate('hello', s)).toHaveLength(1);
        });

        it('should validate pattern', () => {
            const s: SchemaDefinition = { type: 'string', pattern: '^[a-z]+$' };
            expect(validator.validate('hello', s)).toHaveLength(0);
            expect(validator.validate('Hello123', s)).toHaveLength(1);
        });
    });

    describe('number validation', () => {
        const schema: SchemaDefinition = { type: 'number' };

        it('should pass valid numbers', () => {
            expect(validator.validate(42, schema)).toHaveLength(0);
            expect(validator.validate(3.14, schema)).toHaveLength(0);
        });

        it('should fail non-numbers', () => {
            expect(validator.validate('42', schema)).toHaveLength(1);
        });

        it('should validate min/max', () => {
            const s: SchemaDefinition = { type: 'number', min: 0, max: 1 };
            expect(validator.validate(0.5, s)).toHaveLength(0);
            expect(validator.validate(-1, s)).toHaveLength(1);
            expect(validator.validate(2, s)).toHaveLength(1);
        });

        it('should reject NaN', () => {
            expect(validator.validate(NaN, schema)).toHaveLength(1);
        });
    });

    describe('boolean validation', () => {
        it('should pass booleans', () => {
            const s: SchemaDefinition = { type: 'boolean' };
            expect(validator.validate(true, s)).toHaveLength(0);
            expect(validator.validate(false, s)).toHaveLength(0);
        });

        it('should fail non-booleans', () => {
            const s: SchemaDefinition = { type: 'boolean' };
            expect(validator.validate(1, s)).toHaveLength(1);
        });
    });

    describe('object validation', () => {
        it('should pass valid objects', () => {
            const s: SchemaDefinition = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
            };
            expect(validator.validate({ name: 'Alice', age: 30 }, s)).toHaveLength(0);
        });

        it('should validate required fields', () => {
            const s: SchemaDefinition = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    email: { type: 'string' },
                },
                required: ['name', 'email'],
            };
            const issues = validator.validate({ name: 'Alice' }, s);
            expect(issues).toHaveLength(1);
            expect(issues[0]!.path).toContain('email');
        });

        it('should validate nested objects', () => {
            const s: SchemaDefinition = {
                type: 'object',
                properties: {
                    address: {
                        type: 'object',
                        properties: {
                            city: { type: 'string' },
                        },
                        required: ['city'],
                    },
                },
            };
            expect(
                validator.validate({ address: { city: 'Paris' } }, s),
            ).toHaveLength(0);
            expect(
                validator.validate({ address: { city: 123 } }, s),
            ).toHaveLength(1);
        });

        it('should fail non-objects', () => {
            const s: SchemaDefinition = { type: 'object' };
            expect(validator.validate('string', s)).toHaveLength(1);
            expect(validator.validate([1, 2], s)).toHaveLength(1);
        });
    });

    describe('array validation', () => {
        it('should pass valid arrays', () => {
            const s: SchemaDefinition = { type: 'array' };
            expect(validator.validate([1, 2, 3], s)).toHaveLength(0);
        });

        it('should validate min/max length', () => {
            const s: SchemaDefinition = { type: 'array', min: 2, max: 4 };
            expect(validator.validate([1], s)).toHaveLength(1);
            expect(validator.validate([1, 2, 3, 4, 5], s)).toHaveLength(1);
            expect(validator.validate([1, 2, 3], s)).toHaveLength(0);
        });

        it('should validate items schema', () => {
            const s: SchemaDefinition = {
                type: 'array',
                items: { type: 'number' },
            };
            expect(validator.validate([1, 2, 3], s)).toHaveLength(0);
            expect(validator.validate([1, 'two', 3], s)).toHaveLength(1);
        });

        it('should fail non-arrays', () => {
            const s: SchemaDefinition = { type: 'array' };
            expect(validator.validate('not array', s)).toHaveLength(1);
        });
    });

    describe('enum validation', () => {
        it('should pass matching enum values', () => {
            const s: SchemaDefinition = {
                type: 'string',
                enum: ['red', 'green', 'blue'],
            };
            expect(validator.validate('red', s)).toHaveLength(0);
        });

        it('should fail non-matching enum values', () => {
            const s: SchemaDefinition = {
                type: 'string',
                enum: ['red', 'green', 'blue'],
            };
            expect(validator.validate('yellow', s)).toHaveLength(1);
        });
    });

    describe('any type', () => {
        it('should accept any value', () => {
            const s: SchemaDefinition = { type: 'any' };
            expect(validator.validate(42, s)).toHaveLength(0);
            expect(validator.validate('hello', s)).toHaveLength(0);
            expect(validator.validate(null, s)).toHaveLength(0);
            expect(validator.validate(undefined, s)).toHaveLength(0);
        });
    });

    describe('null/undefined handling', () => {
        it('should report null values for typed schemas', () => {
            const s: SchemaDefinition = { type: 'string' };
            expect(validator.validate(null, s)).toHaveLength(1);
            expect(validator.validate(undefined, s)).toHaveLength(1);
        });
    });
});
