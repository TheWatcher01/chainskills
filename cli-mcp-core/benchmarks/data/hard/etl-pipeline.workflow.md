---
name: etl-pipeline
version: 1.0.0
domain: data
difficulty: hard
description: "Design an ETL pipeline"
---

# Step 1 — Requirements
@call shell.exec(echo "Source: 3 PostgreSQL databases (users, orders, products). Target: analytics warehouse. Volume: 10M rows/day. SLA: data freshness < 1 hour. Requirements: deduplication, schema evolution, error recovery.") → $requirements

# Step 2 — Design
@agent copilot Design a complete ETL pipeline architecture. Include: extraction strategy (CDC vs batch), transformation steps, loading pattern (upsert vs append), orchestration tool recommendation, monitoring, and error handling. Format as markdown: $requirements → $design

# Step 3 — Output
@output design = $design
