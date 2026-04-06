---
name: api-chain
domain: tool-use
difficulty: medium
description: Chain multiple API calls with data transformation
version: "1.0"
outputs:
  - name: result
    type: string
---

# API Chain

## Step 1 — Fetch Data

@call curl -s "https://jsonplaceholder.typicode.com/users/1" 2>/dev/null || echo '{"name":"test","email":"test@test.com"}'

@output user_data = $STDOUT

## Step 2 — Transform

@agent copilot
Extract the user name and email from this JSON and format as a markdown profile card:
$user_data

@output result = $AGENT_RESULT
