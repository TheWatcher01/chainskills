---
name: lineage-trace
version: 1.0.0
domain: data
difficulty: hard
description: "Trace data lineage through transformations"
---

# Step 1 — Pipeline description
@call shell.exec(echo "Pipeline: raw_logs (S3) → clean_logs (Spark dedup+filter) → enriched_logs (join with user_dim) → daily_metrics (aggregate by user_id, date) → dashboard_cache (Redis). Question: If a metric on the dashboard seems wrong, trace the possible causes at each stage.") → $pipeline

# Step 2 — Trace lineage
@agent copilot Trace the data lineage for this pipeline. At each stage, identify: what could go wrong, how to detect issues, and how to validate data. Format as a lineage diagram with annotations: $pipeline → $lineage

# Step 3 — Output
@output lineage = $lineage
