---
name: file-search
domain: tool-use
difficulty: easy
description: Search files matching a pattern
version: "1.0"
inputs:
  - name: pattern
    type: string
    default: "*.ts"
  - name: dir
    type: string
    default: "."
outputs:
  - name: files
    type: string
---

# File Search

## Step 1 — Search

@call find $dir -name "$pattern" -type f | head -20

@output files = $STDOUT
