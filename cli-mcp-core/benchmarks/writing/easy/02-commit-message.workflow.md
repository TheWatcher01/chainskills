---
name: commit-message
domain: writing
difficulty: easy
description: Generate conventional commit message from diff
version: "1.0"
inputs:
  - name: diff
    type: string
    default: "Added user authentication middleware with JWT validation"
outputs:
  - name: message
    type: string
---

# Commit Message

## Step 1 — Generate

@agent writer
Write a conventional commit message for this change:
$diff
Follow the format: type(scope): description
Include a body explaining why, not just what.

@output message = $AGENT_RESULT
