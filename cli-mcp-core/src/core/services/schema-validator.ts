/**
 * Schema validator service — recursive value validation against schema definitions.
 *
 * Pure core service, zero external dependencies. Validates primitive types,
 * nested objects, arrays, required fields, min/max, patterns, and enums.
 *
 * @module core/services/schema-validator
 */

import type {
    SchemaDefinition,
    SchemaValidator,
    ValidationIssue,
} from '#core/ports/schema-validator.port.js';

/**
 * Create a `SchemaValidator`.
 *
 * @returns A schema validator with a `validate()` method.
 */
export function createSchemaValidator(): SchemaValidator {
    return {
        validate(
            value: unknown,
            schema: SchemaDefinition,
            path: string = '$',
        ): readonly ValidationIssue[] {
            return validateValue(value, schema, path);
        },
    };
}

// ─── Recursive Validation ───────────────────────────────────────────────────

function validateValue(
    value: unknown,
    schema: SchemaDefinition,
    path: string,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // 'any' type — always valid
    if (schema.type === 'any') return issues;

    // Null/undefined check
    if (value === null || value === undefined) {
        issues.push({
            path,
            message: `Expected ${schema.type}, got ${value === null ? 'null' : 'undefined'}`,
            expected: schema.type,
            actual: String(value),
        });
        return issues;
    }

    // Enum check (applies to all types)
    if (schema.enum && schema.enum.length > 0) {
        if (!schema.enum.includes(value)) {
            issues.push({
                path,
                message: `Value must be one of: ${schema.enum.map(String).join(', ')}`,
                expected: `one of [${schema.enum.map(String).join(', ')}]`,
                actual: String(value),
            });
        }
    }

    switch (schema.type) {
        case 'string':
            issues.push(...validateString(value, schema, path));
            break;
        case 'number':
            issues.push(...validateNumber(value, schema, path));
            break;
        case 'boolean':
            if (typeof value !== 'boolean') {
                issues.push({
                    path,
                    message: `Expected boolean, got ${typeof value}`,
                    expected: 'boolean',
                    actual: typeof value,
                });
            }
            break;
        case 'object':
            issues.push(...validateObject(value, schema, path));
            break;
        case 'array':
            issues.push(...validateArray(value, schema, path));
            break;
    }

    return issues;
}

function validateString(
    value: unknown,
    schema: SchemaDefinition,
    path: string,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (typeof value !== 'string') {
        issues.push({
            path,
            message: `Expected string, got ${typeof value}`,
            expected: 'string',
            actual: typeof value,
        });
        return issues;
    }

    if (schema.minLength !== undefined && value.length < schema.minLength) {
        issues.push({
            path,
            message: `String length ${value.length} is below minimum ${schema.minLength}`,
            expected: `minLength ${schema.minLength}`,
            actual: `length ${value.length}`,
        });
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        issues.push({
            path,
            message: `String length ${value.length} exceeds maximum ${schema.maxLength}`,
            expected: `maxLength ${schema.maxLength}`,
            actual: `length ${value.length}`,
        });
    }

    if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
            issues.push({
                path,
                message: `String does not match pattern: ${schema.pattern}`,
                expected: `pattern /${schema.pattern}/`,
                actual: value,
            });
        }
    }

    return issues;
}

function validateNumber(
    value: unknown,
    schema: SchemaDefinition,
    path: string,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (typeof value !== 'number' || Number.isNaN(value)) {
        issues.push({
            path,
            message: `Expected number, got ${typeof value}`,
            expected: 'number',
            actual: typeof value,
        });
        return issues;
    }

    if (schema.min !== undefined && value < schema.min) {
        issues.push({
            path,
            message: `Number ${value} is below minimum ${schema.min}`,
            expected: `>= ${schema.min}`,
            actual: String(value),
        });
    }

    if (schema.max !== undefined && value > schema.max) {
        issues.push({
            path,
            message: `Number ${value} exceeds maximum ${schema.max}`,
            expected: `<= ${schema.max}`,
            actual: String(value),
        });
    }

    return issues;
}

function validateObject(
    value: unknown,
    schema: SchemaDefinition,
    path: string,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (typeof value !== 'object' || Array.isArray(value)) {
        issues.push({
            path,
            message: `Expected object, got ${Array.isArray(value) ? 'array' : typeof value}`,
            expected: 'object',
            actual: Array.isArray(value) ? 'array' : typeof value,
        });
        return issues;
    }

    const obj = value as Record<string, unknown>;

    // Check required fields
    if (schema.required) {
        for (const field of schema.required) {
            if (!(field in obj) || obj[field] === undefined) {
                issues.push({
                    path: `${path}.${field}`,
                    message: `Required field "${field}" is missing`,
                    expected: 'present',
                    actual: 'missing',
                });
            }
        }
    }

    // Validate properties
    if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
            if (key in obj) {
                issues.push(
                    ...validateValue(obj[key], propSchema, `${path}.${key}`),
                );
            }
        }
    }

    return issues;
}

function validateArray(
    value: unknown,
    schema: SchemaDefinition,
    path: string,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!Array.isArray(value)) {
        issues.push({
            path,
            message: `Expected array, got ${typeof value}`,
            expected: 'array',
            actual: typeof value,
        });
        return issues;
    }

    if (schema.min !== undefined && value.length < schema.min) {
        issues.push({
            path,
            message: `Array length ${value.length} is below minimum ${schema.min}`,
            expected: `min ${schema.min} items`,
            actual: `${value.length} items`,
        });
    }

    if (schema.max !== undefined && value.length > schema.max) {
        issues.push({
            path,
            message: `Array length ${value.length} exceeds maximum ${schema.max}`,
            expected: `max ${schema.max} items`,
            actual: `${value.length} items`,
        });
    }

    // Validate items
    if (schema.items) {
        for (let i = 0; i < value.length; i++) {
            issues.push(
                ...validateValue(value[i], schema.items, `${path}[${i}]`),
            );
        }
    }

    return issues;
}
