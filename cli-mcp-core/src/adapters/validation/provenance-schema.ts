/**
 * Zod schemas for data provenance and LLM output validation.
 *
 * Used at adapter boundaries to validate external data before
 * it enters the domain. Never used in core/.
 *
 * @module adapters/validation/provenance-schema
 */

import { z } from 'zod';

/** Zod schema for DataProvenance validation. */
export const DataProvenanceSchema = z.object({
    source_name: z.string().min(1),
    source_url: z.string().url(),
    source_updated_at: z.string().datetime(),
    ingested_at: z.string().datetime(),
    confidence_score: z.number().min(0).max(1),
    confidence_reason: z.string().min(1),
    verification_status: z.enum(['raw', 'normalized', 'cross_referenced', 'human_verified']),
    lineage_run_id: z.string().uuid().optional(),
    source_tier: z.enum(['A', 'B', 'C']).optional(),
});

/** Inferred type from the Zod schema. */
export type ValidatedProvenance = z.infer<typeof DataProvenanceSchema>;

/** Zod schema for validating LLM output with optional provenance. */
export const LLMOutputSchema = z.object({
    content: z.string(),
    model_id: z.string().optional(),
    provenance: DataProvenanceSchema.optional(),
});

/** Inferred type from the LLM output schema. */
export type ValidatedLLMOutput = z.infer<typeof LLMOutputSchema>;

/** Validate and parse a DataProvenance object. Returns Zod result. */
export function validateProvenance(data: unknown) {
    return DataProvenanceSchema.safeParse(data);
}

/** Validate and parse an LLM output object. Returns Zod result. */
export function validateLLMOutput(data: unknown) {
    return LLMOutputSchema.safeParse(data);
}
