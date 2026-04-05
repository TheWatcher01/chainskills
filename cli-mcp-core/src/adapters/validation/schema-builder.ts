/**
 * Schema builder — converts simplified JSON Schema to Zod runtime validators.
 *
 * Used by the @schema directive to validate LLM outputs against a declared schema.
 * Supports a practical subset of JSON Schema: string, number, boolean, object, array.
 *
 * @module adapters/validation/schema-builder
 */

import { z } from 'zod';
import type { Result } from '#infra/errors.js';
import { ok, err, validationError } from '#infra/errors.js';
import type { ValidationError } from '#infra/errors.js';

/** Simplified JSON Schema property definition. */
interface JsonSchemaProperty {
    readonly type?: string;
    readonly minLength?: number;
    readonly maxLength?: number;
    readonly pattern?: string;
    readonly minimum?: number;
    readonly maximum?: number;
    readonly enum?: readonly unknown[];
    readonly items?: JsonSchemaProperty;
    readonly properties?: Record<string, JsonSchemaProperty>;
    readonly required?: readonly string[];
}

/**
 * Build a Zod schema from a simplified JSON Schema definition.
 *
 * @param jsonSchema - JSON Schema-like object
 * @returns Result containing a Zod type or a validation error
 */
export function buildZodSchema(
    jsonSchema: Record<string, unknown>,
): Result<z.ZodType, ValidationError> {
    try {
        const schema = buildPropertySchema(jsonSchema as JsonSchemaProperty);
        return ok(schema);
    } catch (e) {
        return err(
            validationError(
                'SCHEMA_BUILD_ERROR',
                `Failed to build Zod schema: ${e instanceof Error ? e.message : String(e)}`,
            ),
        );
    }
}

function buildPropertySchema(prop: JsonSchemaProperty): z.ZodType {
    const type = prop.type;

    switch (type) {
        case 'string': {
            let schema: z.ZodString = z.string();
            if (prop.minLength !== undefined) schema = schema.min(prop.minLength);
            if (prop.maxLength !== undefined) schema = schema.max(prop.maxLength);
            if (prop.pattern) schema = schema.regex(new RegExp(prop.pattern));
            if (prop.enum) return z.enum(prop.enum as [string, ...string[]]);
            return schema;
        }

        case 'number':
        case 'integer': {
            let schema: z.ZodNumber = z.number();
            if (type === 'integer') schema = schema.int();
            if (prop.minimum !== undefined) schema = schema.min(prop.minimum);
            if (prop.maximum !== undefined) schema = schema.max(prop.maximum);
            return schema;
        }

        case 'boolean':
            return z.boolean();

        case 'array': {
            const itemSchema = prop.items
                ? buildPropertySchema(prop.items)
                : z.unknown();
            return z.array(itemSchema);
        }

        case 'object': {
            if (!prop.properties) return z.record(z.unknown());

            const shape: Record<string, z.ZodType> = {};
            const requiredFields = new Set(prop.required ?? []);

            for (const [key, value] of Object.entries(prop.properties)) {
                const fieldSchema = buildPropertySchema(value);
                shape[key] = requiredFields.has(key)
                    ? fieldSchema
                    : fieldSchema.optional();
            }

            return z.object(shape);
        }

        default:
            return z.unknown();
    }
}

/**
 * Validate a value against a Zod schema and return a structured result.
 */
export function validateWithSchema(
    schema: z.ZodType,
    value: unknown,
): Result<unknown, ValidationError> {
    // Try to parse as JSON if string
    let parsed = value;
    if (typeof value === 'string') {
        try {
            parsed = JSON.parse(value);
        } catch {
            // Keep as string
        }
    }

    const result = schema.safeParse(parsed);
    if (result.success) {
        return ok(result.data);
    }

    const issues = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');

    return err(
        validationError('SCHEMA_VALIDATION_FAILED', `Schema validation failed: ${issues}`),
    );
}
