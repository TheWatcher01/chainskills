/**
 * Data provenance metadata — tracks origin, freshness, and confidence
 * for any data sourced externally or derived by AI.
 *
 * ISO 8000-8 compliant. W3C PROV inspired.
 *
 * @module core/entities/data-provenance
 */

/** Verification status progression: raw → normalized → cross_referenced → human_verified */
export type VerificationStatus = 'raw' | 'normalized' | 'cross_referenced' | 'human_verified';

/** Source reliability tier. */
export type SourceTier = 'A' | 'B' | 'C';

/** Provenance metadata attached to every external data record. */
export interface DataProvenance {
    /** Source identifier (e.g., "api-sirene-insee", "github-owner/repo"). */
    readonly source_name: string;
    /** Exact URL of the source query. */
    readonly source_url: string;
    /** When the source last updated this data (ISO 8601). */
    readonly source_updated_at: string;
    /** When we ingested this data (ISO 8601). */
    readonly ingested_at: string;
    /** Confidence score (0.0–1.0). */
    readonly confidence_score: number;
    /** Human-readable reason for the confidence score. */
    readonly confidence_reason: string;
    /** Current verification level. */
    readonly verification_status: VerificationStatus;
    /** Optional lineage run ID for audit trail. */
    readonly lineage_run_id?: string;
    /** Optional source reliability tier. */
    readonly source_tier?: SourceTier;
}

/** Freshness classification based on age. */
export type FreshnessStatus = 'fresh' | 'aging' | 'stale' | 'expired' | 'unverified';

/** Classify freshness from a source_updated_at date. */
export function classifyFreshness(sourceUpdatedAt: string, now?: string): FreshnessStatus {
    const sourceDate = new Date(sourceUpdatedAt);
    const currentDate = now ? new Date(now) : new Date();
    const ageDays = (currentDate.getTime() - sourceDate.getTime()) / (1000 * 60 * 60 * 24);

    if (isNaN(ageDays)) return 'unverified';
    if (ageDays < 90) return 'fresh';
    if (ageDays < 365) return 'aging';
    if (ageDays < 730) return 'stale';
    return 'expired';
}
