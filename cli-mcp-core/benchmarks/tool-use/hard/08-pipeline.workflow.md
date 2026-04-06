---
name: pipeline
domain: tool-use
difficulty: hard
description: Multi-step data pipeline with validation
version: "1.0"
outputs:
  - name: validated
    type: string
  - name: transformed
    type: string
---

# Data Pipeline

## Step 1 — Extract

@call echo '[{"name":"Alice","age":30},{"name":"Bob","age":-5},{"name":"","age":25},{"name":"Charlie","age":35}]'

@output raw_data = $STDOUT

## Step 2 — Validate

@agent copilot
Validate this JSON data and return only valid records (name non-empty, age 0-150):
$raw_data
Return as JSON array.

@output validated = $AGENT_RESULT

## Step 3 — Transform

@agent copilot
Transform this validated data:
$validated
- Add an "id" field (uuid-like string)
- Capitalize names
- Add "category": "young" if age < 30, "adult" if 30-60, "senior" if > 60
Return as JSON.

@output transformed = $AGENT_RESULT
