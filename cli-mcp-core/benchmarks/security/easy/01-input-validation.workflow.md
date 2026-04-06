---
name: input-validation
domain: security
difficulty: easy
description: Write input validation for a registration form
version: "1.0"
outputs:
  - name: solution
    type: string
---

# Input Validation

## Step 1 — Validate

@agent copilot
Write a Zod schema in TypeScript for a registration form:
- email: valid email format
- password: min 8 chars, 1 uppercase, 1 number, 1 special char
- username: 3-20 chars, alphanumeric + underscore only
- age: optional, 13-120
Include custom error messages in French.

@output solution = $AGENT_RESULT
