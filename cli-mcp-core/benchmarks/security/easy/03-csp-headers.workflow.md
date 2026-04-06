---
name: csp-headers
domain: security
difficulty: easy
description: Generate Content Security Policy headers
version: "1.0"
outputs:
  - name: solution
    type: string
---

# CSP Headers

## Step 1 — Generate

@agent copilot
Write an Express.js middleware that sets secure HTTP headers:
- Content-Security-Policy (strict, no inline scripts, nonce-based)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security with preload
- Permissions-Policy: deny all sensitive APIs
Explain each directive in comments.

@output solution = $AGENT_RESULT
