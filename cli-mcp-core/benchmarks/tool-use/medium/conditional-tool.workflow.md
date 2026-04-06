---
name: conditional-tool
version: 1.0.0
domain: tool-use
difficulty: medium
description: "Use tools conditionally based on results"
---

# Step 1 — Check environment
@call shell.exec(echo "linux") → $os

# Step 2 — Conditional execution
@if $os == "linux"
@call shell.exec(uname -r) → $kernel
@else
@call shell.exec(echo "not linux") → $kernel

# Step 3 — Agent interprets
@agent copilot What Linux kernel version is this? Is it recent (2024+)? Answer briefly: $kernel → $interpretation

# Step 4 — Output
@output kernel = $kernel
@output interpretation = $interpretation
