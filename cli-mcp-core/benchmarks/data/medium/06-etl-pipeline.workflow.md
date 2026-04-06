---
name: etl-pipeline
domain: data
difficulty: medium
description: Design an ETL pipeline for API data
version: "1.0"
outputs:
  - name: solution
    type: string
---

# ETL Pipeline

## Step 1 — Design

@agent copilot
Design a Python ETL pipeline that:
- Extracts: paginated REST API (100 items/page)
- Transforms: normalize dates to ISO 8601, deduplicate by ID, validate with Pydantic
- Loads: batch insert to PostgreSQL with upsert
Include error handling, retry logic, and logging.

@output solution = $AGENT_RESULT
