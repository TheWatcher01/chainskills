---
name: secret-detection
version: 1.0.0
domain: security
difficulty: medium
description: "Detect hardcoded secrets in code"
---

# Step 1 — Code
@call shell.exec(echo "const API_KEY = \"sk-proj-abc123def456\"; const DB_URL = \"postgres://admin:password123@db.example.com:5432/prod\"; const JWT_SECRET = \"mysecretkey\"; const config = { aws_access_key_id: \"AKIAIOSFODNN7EXAMPLE\" };") → $code

# Step 2 — Detect
@agent copilot Scan this code for hardcoded secrets. For each finding: classify the secret type, assess the risk level, and recommend how to properly manage it (env vars, vault, etc.): $code → $findings

# Step 3 — Output
@output findings = $findings
