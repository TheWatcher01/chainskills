---
name: parse-json
version: 1.0.0
domain: data
difficulty: easy
description: "Parse and transform JSON data"
---

# Step 1 — Input JSON
@call shell.exec(echo "{\"users\":[{\"first\":\"Alice\",\"last\":\"Smith\",\"age\":30},{\"first\":\"Bob\",\"last\":\"Jones\",\"age\":25}]}") → $json

# Step 2 — Transform
@agent copilot Transform this JSON: merge first+last into fullName, add isAdult (age>=18), remove age. Return as JSON array: $json → $transformed

# Step 3 — Output
@output transformed = $transformed
