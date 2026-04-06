---
name: data-quality-audit
version: 1.0.0
domain: data
difficulty: hard
description: "Audit data quality across dimensions"
---

# Step 1 — Dataset
@call shell.exec(echo "id,name,email,created,status\n1,Alice,alice@co.com,2026-01-01,active\n2,,bob@co,2026-13-01,active\n3,Charlie,charlie@co.com,2026-01-15,actve\n1,Alice Dup,alice2@co.com,2026-01-01,active\n4,David,david@co.com,,inactive") → $data

# Step 2 — Audit
@agent copilot Audit this dataset on all quality dimensions: completeness, accuracy, consistency, uniqueness, timeliness, validity. Score each 0-100 and list specific issues found. Format as structured report: $data → $audit

# Step 3 — Output
@output audit = $audit
