---
name: code-review
version: 1.0.0
domain: coding
difficulty: easy
description: "Review a code snippet for basic issues"
---

# Step 1 — Review code
@call shell.exec(echo "function add(a,b) { return a + b; }") → $code

# Step 2 — Agent review
@agent copilot Review this code for bugs and suggest improvements: $code → $review

# Step 3 — Output
@output review = $review
