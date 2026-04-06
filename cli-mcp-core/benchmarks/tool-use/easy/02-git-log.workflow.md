---
name: git-log
domain: tool-use
difficulty: easy
description: Get recent git commits
version: "1.0"
outputs:
  - name: log
    type: string
---

# Git Log

## Step 1 — Fetch

@call git log --oneline -10 2>/dev/null || echo "Not a git repo"

@output log = $STDOUT
