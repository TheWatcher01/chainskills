---
name: api-call
version: 1.0.0
domain: tool-use
difficulty: easy
description: "Make a simple API call and process result"
---

# Step 1 — Call API
@call shell.exec(echo "{\"status\":\"ok\",\"data\":{\"name\":\"test\",\"version\":\"1.0\"}}") → $response

# Step 2 — Extract
@agent copilot Extract the name and version from this JSON response. Return as: name=X, version=Y: $response → $extracted

# Step 3 — Output
@output extracted = $extracted
