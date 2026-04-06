---
name: migrate-framework
version: 1.0.0
domain: coding
difficulty: hard
description: "Plan a framework migration"
---

# Step 1 — Context
@call shell.exec(echo "Migrate a REST API from Express.js to Fastify. The API has 15 endpoints, uses middleware for auth and logging, connects to PostgreSQL via Sequelize, and serves 5K req/sec.") → $context

# Step 2 — Migration plan
@agent copilot Create a detailed migration plan with phases, risk assessment, rollback strategy, and code examples for key patterns (middleware → hooks, route handlers). Format as markdown: $context → $plan

# Step 3 — Output
@output plan = $plan
