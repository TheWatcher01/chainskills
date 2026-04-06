---
name: api-docs
domain: writing
difficulty: medium
description: Generate OpenAPI specification from endpoint descriptions
version: "1.0"
outputs:
  - name: spec
    type: string
  - name: review
    type: string
---

# API Documentation

## Step 1 — Generate

@agent writer
Generate an OpenAPI 3.1 specification in YAML for a user management API:
- POST /auth/register (email, password, name)
- POST /auth/login (email, password) → JWT tokens
- GET /users/me → current user profile
- PATCH /users/me (name, avatar)
- GET /users/:id → public profile
Include: schemas, error responses (400, 401, 404, 429), security schemes, examples.

@output spec = $AGENT_RESULT

## Step 2 — Review

@agent reviewer
Review this OpenAPI spec for completeness and REST best practices:
$spec

@output review = $AGENT_RESULT
