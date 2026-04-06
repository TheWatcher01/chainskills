---
name: conditional-tools
domain: tool-use
difficulty: medium
description: Use tools conditionally based on OS
version: "1.0"
outputs:
  - name: system_info
    type: string
---

# Conditional Tools

## Step 1 — Detect OS

@call uname -s 2>/dev/null || echo "Windows"

@output os_name = $STDOUT

## Step 2 — Gather Info

@if $os_name contains "Linux"
@call cat /etc/os-release 2>/dev/null | head -5

@if $os_name contains "Darwin"
@call sw_vers 2>/dev/null

## Step 3 — Summarize

@agent copilot
Summarize this system information in a structured format:
OS: $os_name

@output system_info = $AGENT_RESULT
