---
name: add-test
version: 1.0.0
domain: coding
difficulty: easy
description: "Generate a unit test for a simple function"
---

# Step 1 — Function
@call shell.exec(echo "export function multiply(a: number, b: number): number { return a * b; }") → $func

# Step 2 — Generate test
@agent copilot Write a Vitest unit test for this function. Include at least 3 test cases: $func → $test

# Step 3 — Output
@output test = $test
