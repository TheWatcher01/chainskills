---
name: debug-error
version: 1.0.0
domain: coding
difficulty: medium
description: "Identify and fix a bug in code"
---

# Step 1 — Buggy code
@call shell.exec(echo "function fib(n) { if (n <= 1) return 1; return fib(n-1) + fib(n-2); }") → $buggy

# Step 2 — Debug
@agent copilot This fibonacci function has an off-by-one error (fib(0) should be 0, not 1). Fix it and explain: $buggy → $fix

# Step 3 — Output
@output fix = $fix
