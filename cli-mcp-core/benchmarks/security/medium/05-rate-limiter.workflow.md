---
name: rate-limiter
domain: security
difficulty: medium
description: Implement distributed rate limiter
version: "1.0"
outputs:
  - name: solution
    type: string
---

# Rate Limiter

## Step 1 — Implement

@agent copilot
Implement a sliding window rate limiter in TypeScript:
- In-memory implementation (no Redis)
- Token bucket algorithm
- Per-IP and per-user rate limiting
- Configurable: window size, max requests, burst allowance
- Return remaining requests and reset time in headers
- Express middleware compatible

@output solution = $AGENT_RESULT
