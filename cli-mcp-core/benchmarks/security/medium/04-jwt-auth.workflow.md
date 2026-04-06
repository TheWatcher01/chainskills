---
name: jwt-auth
domain: security
difficulty: medium
description: Implement JWT authentication with refresh tokens
version: "1.0"
outputs:
  - name: solution
    type: string
  - name: review
    type: string
---

# JWT Authentication

## Step 1 — Implement

@agent copilot
Implement JWT authentication in TypeScript (no framework):
- createAccessToken(userId, roles): short-lived (15min)
- createRefreshToken(userId): long-lived (7d), stored in httpOnly cookie
- verifyToken(token): decoded payload or error
- refreshFlow(refreshToken): new access + refresh pair
- Rotation: invalidate old refresh token on use
Use Ed25519 asymmetric keys (not HS256).

@output solution = $AGENT_RESULT

## Step 2 — Audit

@agent reviewer
Security audit this JWT implementation for:
- Token fixation attacks
- Refresh token replay
- Key management
- Timing attacks
- XSS/CSRF vectors
$solution

@output review = $AGENT_RESULT
