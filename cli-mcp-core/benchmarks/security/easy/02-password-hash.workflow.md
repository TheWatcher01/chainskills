---
name: password-hash
domain: security
difficulty: easy
description: Implement secure password hashing
version: "1.0"
outputs:
  - name: solution
    type: string
---

# Password Hashing

## Step 1 — Implement

@agent copilot
Write a Node.js module for secure password hashing using argon2id:
- hashPassword(password): Promise<string>
- verifyPassword(password, hash): Promise<boolean>
Use crypto.randomBytes for salt. Include timing-safe comparison.

@output solution = $AGENT_RESULT
