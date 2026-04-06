---
name: oauth-pkce
domain: security
difficulty: hard
description: Implement OAuth2 PKCE flow
version: "1.0"
outputs:
  - name: solution
    type: string
---

# OAuth2 PKCE

## Step 1 — Implement

@agent copilot
Implement a complete OAuth2 Authorization Code with PKCE flow in TypeScript:
- generateCodeVerifier(): cryptographically random 43-128 char string
- generateCodeChallenge(verifier): S256 hash
- buildAuthorizationUrl(config, state, codeChallenge): URL
- exchangeCode(code, codeVerifier, config): tokens
- refreshAccessToken(refreshToken, config): new tokens
- State parameter validation to prevent CSRF
Include all types, no SDK dependencies, native fetch only.

@output solution = $AGENT_RESULT
