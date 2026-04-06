/**
 * Workflow generation entities — auto-generated workflow variants.
 *
 * Pure value objects, zero external dependencies.
 *
 * @module core/entities/generation-config
 */

import type { TokenUsage } from './execution-trace.js';

/** A single generated workflow variant. */
export interface WorkflowVariant {
    /** Name of the base template. */
    readonly baseWorkflow: string;
    /** Variant index (0-based). */
    readonly variantIndex: number;
    /** Constraint/optimization applied. */
    readonly constraint: string;
    /** Generated .workflow.md source. */
    readonly source: string;
    /** Whether the generated workflow passed validation. */
    readonly valid: boolean;
    /** Validation error if invalid. */
    readonly validationError?: string;
    /** Model used for generation. */
    readonly model: string;
    /** Token usage for generation. */
    readonly tokens?: TokenUsage;
    /** Generation timestamp. */
    readonly generatedAt: string;
}

/** Predefined generation constraints. */
export interface GenerationConstraint {
    /** Constraint identifier. */
    readonly name: string;
    /** Human-readable description for the LLM prompt. */
    readonly description: string;
}

/** Report summarizing a generation batch. */
export interface GenerationReport {
    /** Base template name. */
    readonly template: string;
    /** Total variations attempted. */
    readonly totalVariations: number;
    /** Successfully generated and validated. */
    readonly successful: number;
    /** Failed generation or validation. */
    readonly failed: number;
    /** Total tokens consumed. */
    readonly totalTokens: number;
    /** All generated variants. */
    readonly variants: readonly WorkflowVariant[];
    /** Provenance info. */
    readonly generatedBy: string;
    /** Report timestamp. */
    readonly timestamp: string;
}

/** Default generation constraints. */
export const DEFAULT_CONSTRAINTS: readonly GenerationConstraint[] = [
    { name: 'speed', description: 'Optimize for token efficiency and faster execution' },
    { name: 'reliability', description: 'Add comprehensive error handling, retries, and fallbacks' },
    { name: 'validation', description: 'Add strict input validation and output schema enforcement' },
    { name: 'parallel', description: 'Maximize parallelism using @parallel blocks where safe' },
    { name: 'observability', description: 'Add detailed logging, @assert checkpoints, and @breakpoints' },
];
