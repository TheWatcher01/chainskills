---
name: parallel-fetch
domain: tool-use
difficulty: medium
description: Fetch multiple resources in parallel
version: "1.0"
outputs:
  - name: user1
    type: string
  - name: user2
    type: string
  - name: summary
    type: string
---

# Parallel Fetch

## Step 1 — Fetch

@parallel

### Fetch User 1
@call curl -s "https://jsonplaceholder.typicode.com/users/1" 2>/dev/null || echo '{"name":"Alice"}'
@output user1 = $STDOUT

### Fetch User 2
@call curl -s "https://jsonplaceholder.typicode.com/users/2" 2>/dev/null || echo '{"name":"Bob"}'
@output user2 = $STDOUT

## Step 2 — Summarize

@agent copilot
Compare these two user profiles and list differences:
User 1: $user1
User 2: $user2

@output summary = $AGENT_RESULT
