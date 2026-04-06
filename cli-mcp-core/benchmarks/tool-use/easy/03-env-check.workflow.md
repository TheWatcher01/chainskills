---
name: env-check
domain: tool-use
difficulty: easy
description: Check environment variables and tools
version: "1.0"
outputs:
  - name: report
    type: string
---

# Environment Check

## Step 1 — Check Node

@call node --version 2>/dev/null || echo "Node.js not found"

## Step 2 — Check pnpm

@call pnpm --version 2>/dev/null || echo "pnpm not found"

## Step 3 — Summarize

@agent copilot
Based on the available tools, summarize the development environment:
- Node.js: $STDOUT
List what's available and what's missing.

@output report = $AGENT_RESULT
