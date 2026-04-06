---
name: validate-schema
version: 1.0.0
domain: data
difficulty: medium
description: "Validate data against a schema"
---

# Step 1 — Data
@call shell.exec(echo "[{\"id\":1,\"name\":\"Widget\",\"price\":9.99,\"stock\":100},{\"id\":\"two\",\"name\":\"\",\"price\":-5,\"stock\":null}]") → $data

# Step 2 — Schema
@call shell.exec(echo "{\"id\":\"number\",\"name\":\"string (non-empty)\",\"price\":\"number (positive)\",\"stock\":\"number (non-negative)\"}") → $schema

# Step 3 — Validate
@agent copilot Validate each record against this schema. Report all violations per record: Data: $data Schema: $schema → $validation

# Step 4 — Output
@output validation = $validation
