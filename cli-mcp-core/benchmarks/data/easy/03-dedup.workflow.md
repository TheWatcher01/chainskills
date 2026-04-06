---
name: dedup
domain: data
difficulty: easy
description: Deduplicate array of objects by key
version: "1.0"
outputs:
  - name: solution
    type: string
---

# Deduplicate

## Step 1 — Dedup

@agent copilot
Write a TypeScript function `dedup<T>(items: T[], key: keyof T): T[]` that removes duplicate objects keeping the first occurrence of each unique key value.

@output solution = $AGENT_RESULT
