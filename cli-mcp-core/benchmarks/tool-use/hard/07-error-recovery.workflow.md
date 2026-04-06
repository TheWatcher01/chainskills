---
name: error-recovery
domain: tool-use
difficulty: hard
description: Chain tools with error recovery
version: "1.0"
outputs:
  - name: result
    type: string
---

# Error Recovery

## Step 1 — Try Primary

@try
@call curl -s --max-time 3 "https://httpbin.org/status/500" && echo "Success"

@on-error
@call echo "Primary failed, using fallback"

## Step 2 — Fallback

@try
@call curl -s --max-time 3 "https://jsonplaceholder.typicode.com/posts/1" 2>/dev/null

@on-error
@call echo '{"title":"Offline fallback","body":"No API available"}'

@output api_result = $STDOUT

## Step 3 — Process

@agent copilot
Process this API result and extract a one-line summary:
$api_result

@output result = $AGENT_RESULT
