---
name: json-flatten
domain: data
difficulty: easy
description: Flatten nested JSON to dot notation
version: "1.0"
outputs:
  - name: solution
    type: string
---

# JSON Flatten

## Step 1 — Flatten

@agent copilot
Write a TypeScript function `flatten(obj: Record<string, unknown>): Record<string, unknown>` that converts nested objects to dot-notation keys.
Example: {a: {b: 1}} → {"a.b": 1}. Handle arrays too.

@output solution = $AGENT_RESULT
