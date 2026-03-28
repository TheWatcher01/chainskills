---
name: verify-data
description: >
  Production-grade data verification workflow with ISO 8000-8 quality dimensions,
  multi-source cross-referencing, and Chain-of-Verification (CoVe) for LLM
  hallucination mitigation. Implements Blueprint-First execution — deterministic
  pipeline with LLM bounded to sub-tasks only.
version: 0.6.0
inputs:
  - name: query
    type: string
    required: true
    description: Data query or entity to verify (e.g., company name, SIREN, topic)
  - name: sources
    type: string
    required: false
    default: "web,github,registry"
    description: Comma-separated source channels to query
  - name: confidence_threshold
    type: number
    required: false
    default: 0.7
    description: Minimum confidence score to accept a claim (0.0-1.0)
  - name: max_sources
    type: number
    required: false
    default: 5
    description: Maximum sources to query per channel
outputs:
  - name: verified_data
    type: object
    description: Verified data records with full provenance
  - name: audit_report
    type: object
    description: ISO 8000-8 quality audit report (9 dimensions)
  - name: lineage
    type: object
    description: Complete data lineage trace (OpenLineage compatible)
env:
  - CHAINSKILLS_EXECUTOR
  - AGENT_API_KEY
tags: [data, verification, iso-8000, provenance, anti-hallucination, cove]
metadata:
  author: TheWatcher01
  license: MIT
  techniques:
    - Chain-of-Verification (CoVe)
    - Multi-source consensus scoring
    - Blueprint-First execution
    - W3C PROV provenance
---

# Step 1 — Initialize Pipeline

Validate inputs and create deterministic execution context.

@assert $query != "" "query input is required — cannot verify empty query"

@call shell.exec("date -Iseconds") -> $pipeline_start
@call shell.exec("node -e \"console.log(crypto.randomUUID())\"") -> $run_id

# Step 2 — Parallel Multi-Source Fetch

Fetch raw data from independent sources simultaneously.
No sequential bias — each source queried in isolation.

@parallel:

## Source A — Official / Web

@try:
@agent: |
  Search official sources for '$query'. Return a JSON array where each element has:
  - claim: string (the factual assertion)
  - source_name: string (e.g., "official-docs-example")
  - source_url: string (exact URL, must be real and verifiable)
  - source_updated_at: string (ISO 8601 date or "unknown")
  - raw_text: string (verbatim excerpt from the source)
  Only use primary sources (official documentation, government APIs, registries).
  Maximum $max_sources sources. Return [] if nothing found.
@agent -> $raw_web
@on-error: log and continue

## Source B — GitHub

@try:
@agent: |
  Search GitHub repositories and documentation for '$query'. Return a JSON array:
  - claim: string
  - source_name: string (format: "github-{owner}/{repo}")
  - source_url: string (exact GitHub URL)
  - source_updated_at: string (last commit date ISO 8601)
  - raw_text: string (verbatim excerpt from README or docs)
  Maximum $max_sources sources. Return [] if nothing found.
@agent -> $raw_github
@on-error: log and continue

## Source C — Package Registry

@try:
@agent: |
  Search npm/PyPI for packages related to '$query'. Return a JSON array:
  - claim: string (package name + version + description)
  - source_name: string (format: "npm-{package}" or "pypi-{package}")
  - source_url: string (registry URL)
  - source_updated_at: string (last publish date ISO 8601)
  - raw_text: string (package metadata excerpt)
  Maximum $max_sources sources. Return [] if nothing found.
@agent -> $raw_registry
@on-error: log and continue

# Step 3 — Normalize and Deduplicate

Transform raw data into DataProvenance schema. Deterministic operation — no LLM creativity.

@agent: |
  You are a data normalization engine. Apply these rules strictly:

  INPUT DATA:
  - Web: $raw_web
  - GitHub: $raw_github
  - Registry: $raw_registry

  RULES:
  1. Parse each source into DataProvenance records:
     - source_name: from raw data
     - source_url: from raw data (must be valid URL)
     - source_updated_at: from raw data (ISO 8601, use "1970-01-01T00:00:00Z" if unknown)
     - ingested_at: "$pipeline_start"
     - confidence_score: 0.50 (initial — single source, not yet verified)
     - confidence_reason: "single_source_unverified"
     - verification_status: "raw"
     - lineage_run_id: "$run_id"
  2. Normalize: trim whitespace, ensure UTF-8, ISO dates
  3. Deduplicate: merge claims with identical source_url
  4. Reject records with empty claim or missing source_url

  Return JSON: { records: [...], stats: { total_raw, total_normalized, duplicates_removed } }
@agent -> $normalized

# Step 4 — Cross-Reference Verification (Chain-of-Verification)

CoVe pattern: decompose each claim → verify independently → score by inter-source agreement.
Confidence is NEVER based on LLM self-assessment.

@agent: |
  You are a cross-reference verification engine implementing Chain-of-Verification (CoVe).

  INPUT: $normalized.records

  For EACH record:

  PHASE 1 — DECOMPOSE: Break the claim into 1-3 independently verifiable sub-claims.

  PHASE 2 — PLAN: For each sub-claim, identify which OTHER records in the dataset
  can serve as independent verification (different source_name required).

  PHASE 3 — VERIFY: Check agreement across sources:
  - 3+ independent sources agree → confidence_score: 0.95, reason: "multi_source_verified_3plus"
  - 2 independent sources agree → confidence_score: 0.85, reason: "dual_source_verified"
  - 1 source, official/government → confidence_score: 0.70, reason: "single_official_source"
  - 1 source, community/unofficial → confidence_score: 0.50, reason: "single_unofficial_source"
  - Sources contradict each other → confidence_score: 0.30, reason: "DISCREPANCY_detected"

  PHASE 4 — UPDATE: Set verification_status to "cross_referenced" if verified by 2+ sources,
  keep "normalized" if single source only.

  IMPORTANT: Do NOT inflate confidence based on your own assessment.
  Score ONLY based on observable inter-source agreement.

  Return JSON: { records: [...updated records...], discrepancies: [...contradictions found...] }
@agent -> $cross_referenced

# Step 5 — Confidence Filtering

Deterministic triage — no LLM judgment, just threshold comparison.

@agent: |
  Filter $cross_referenced.records using threshold $confidence_threshold:

  - ACCEPTED: confidence_score >= $confidence_threshold → verified data
  - FLAGGED: 0.50 <= confidence_score < $confidence_threshold → needs human review
  - REJECTED: confidence_score < 0.50 → insufficient evidence

  For rejected records, include rejection_reason.

  Return JSON: {
    accepted: [...],
    flagged: [...],
    rejected: [...],
    stats: { total, accepted_count, flagged_count, rejected_count }
  }
@agent -> $filtered

# Step 6 — ISO 8000-8 Quality Audit

Score the accepted dataset against all 9 quality dimensions.

@agent: |
  Audit $filtered.accepted against ISO 8000-8 nine dimensions:

  | # | Dimension | Check method |
  |---|-----------|-------------|
  | 1 | Validity | All fields match DataProvenance schema |
  | 2 | Accuracy | Claims verified via cross-reference (Step 4) |
  | 3 | Reliability | Source tier: A=official API, B=official docs, C=community |
  | 4 | Freshness | source_updated_at age: <90d=FRESH, <365d=AGING, <730d=STALE, else EXPIRED |
  | 5 | Completeness | No null required fields (source_name, source_url, confidence_score) |
  | 6 | Coherence | No contradictions between accepted records |
  | 7 | Uniqueness | No duplicate claims on same entity |
  | 8 | Structure | UTF-8, ISO dates, valid URLs |
  | 9 | Traceability | lineage_run_id present on every record |

  Score each dimension 0-100%.
  Overall quality = minimum of all 9 dimensions (weakest link).

  Return JSON: {
    dimensions: [{ name, score_pct, status: "PASS"|"WARN"|"FAIL", details }],
    overall_score: number,
    violations: [{ dimension, severity: "P0"|"P1"|"P2", description }]
  }
@agent -> $audit_report

# Step 7 — Build Lineage Trace

Deterministic — assemble metadata from prior steps.

@call shell.exec("date -Iseconds") -> $pipeline_end

@agent: |
  Build a complete lineage trace (OpenLineage compatible):

  {
    "run_id": "$run_id",
    "job_name": "verify-data",
    "query": "$query",
    "status": "COMPLETE",
    "started_at": "$pipeline_start",
    "ended_at": "$pipeline_end",
    "sources_queried": [list unique source_names from $normalized.records],
    "pipeline_steps": ["init", "parallel_fetch", "normalize", "cross_reference", "filter", "audit"],
    "metrics": {
      "records_ingested": $normalized.stats.total_normalized,
      "records_accepted": $filtered.stats.accepted_count,
      "records_flagged": $filtered.stats.flagged_count,
      "records_rejected": $filtered.stats.rejected_count,
      "quality_score": $audit_report.overall_score,
      "discrepancies_found": length of $cross_referenced.discrepancies
    }
  }
@agent -> $lineage

# Step 8 — Output

@output $filtered.accepted -> $verified_data
@output $audit_report -> $audit_report
@output $lineage -> $lineage
