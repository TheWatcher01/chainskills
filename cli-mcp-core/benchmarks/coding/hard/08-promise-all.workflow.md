---
name: promise-all
domain: coding
difficulty: hard
description: Implement Promise.all from scratch
version: "1.0"
outputs:
  - name: solution
    type: string
---

# Promise.all Implementation

## Step 1 — Implement

@agent copilot
Implement a promiseAll function in TypeScript that:
- Takes an array of promises
- Returns a single promise that resolves when all resolve
- Rejects immediately if any promise rejects
- Preserves order of results
- Handles non-promise values in the array
- Full generic types

@output solution = $AGENT_RESULT
