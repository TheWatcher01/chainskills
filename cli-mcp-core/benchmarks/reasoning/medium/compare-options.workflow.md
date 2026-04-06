---
name: compare-options
version: 1.0.0
domain: reasoning
difficulty: medium
description: "Compare technical options with pros and cons"
---

# Step 1 — Options
@call shell.exec(echo "Compare for a new project: Option A: PostgreSQL (relational, ACID, mature). Option B: MongoDB (document, flexible schema, horizontal scaling). Option C: DynamoDB (managed, serverless, pay-per-request). Context: SaaS app, 100K users, complex queries, team knows SQL.") → $options

# Step 2 — Compare
@agent copilot Create a structured comparison. For each option: list 3 pros, 3 cons, ideal use case, cost estimate, and learning curve. Then provide a recommendation with reasoning: $options → $comparison

# Step 3 — Output
@output comparison = $comparison
