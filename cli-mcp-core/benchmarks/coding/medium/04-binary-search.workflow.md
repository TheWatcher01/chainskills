---
name: binary-search
domain: coding
difficulty: medium
description: Implement binary search with edge cases
version: "1.0"
outputs:
  - name: solution
    type: string
  - name: review
    type: string
---

# Binary Search

## Step 1 — Implement

@agent copilot
Implement binary search in TypeScript that handles:
- Empty arrays
- Duplicate values (return first occurrence)
- Negative numbers
Return the function with JSDoc comments.

@output solution = $AGENT_RESULT

## Step 2 — Review

@agent reviewer
Review this binary search implementation for correctness and edge cases:
$solution

@output review = $AGENT_RESULT
