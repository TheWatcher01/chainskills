---
name: error-messages
domain: writing
difficulty: medium
description: Design user-friendly error messages for an API
version: "1.0"
outputs:
  - name: catalog
    type: string
---

# Error Message Catalog

## Step 1 — Generate

@agent writer
Design a complete error message catalog for a payment API:
- Authentication errors (expired token, invalid credentials, MFA required)
- Validation errors (invalid amount, unsupported currency, missing fields)
- Business errors (insufficient funds, card declined, daily limit exceeded)
- System errors (service unavailable, timeout, rate limited)
For each: error code, HTTP status, user message (French), developer message, suggested fix.
Format as TypeScript const object with proper types.

@output catalog = $AGENT_RESULT
