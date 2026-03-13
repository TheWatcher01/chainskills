/**
 * Schema validator port — defines the schema validation contract.
 *
 * Used by the `@validate` directive and output schema enforcement
 * to check that runtime values match expected shapes.
 *
 * @module core/ports/schema-validator
 */

/** Primitive and compound types supported in schema definitions. */
export type SchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';

/** A single schema definition for validating a value. */
export interface SchemaDefinition {
    readonly type: SchemaType;
    /** Nested properties (for `object` type). */
    readonly properties?: Readonly<Record<string, SchemaDefinition>>;
    /** Required property names (for `object` type). */
    readonly required?: readonly string[];
    /** Items schema (for `array` type). */
    readonly items?: SchemaDefinition;
    /** Minimum value/length. */
    readonly min?: number;
    /** Maximum value/length. */
    readonly max?: number;
    /** Minimum string length. */
    readonly minLength?: number;
    /** Maximum string length. */
    readonly maxLength?: number;
    /** Regex pattern (for `string` type). */
    readonly pattern?: string;
    /** Allowed values enum. */
    readonly enum?: readonly unknown[];
}

/** A single validation issue found during schema validation. */
export interface ValidationIssue {
    readonly path: string;
    readonly message: string;
    readonly expected?: string;
    readonly actual?: string;
}

/** Schema validator — validates values against schema definitions. */
export interface SchemaValidator {
    /** Validate a value against a schema definition. */
    validate(value: unknown, schema: SchemaDefinition, path?: string): readonly ValidationIssue[];
}
