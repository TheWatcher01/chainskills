---
name: reverse-string
domain: coding
difficulty: easy
description: Reverse a string without built-in methods
version: "1.0"
inputs:
  - name: input_string
    type: string
    default: "hello world"
outputs:
  - name: solution
    type: string
---

# Reverse String

## Step 1 — Generate

@agent copilot
Write a function in Python that reverses the string "$input_string" without using built-in reverse methods or slicing.
Return only the function code.

@output solution = $AGENT_RESULT
