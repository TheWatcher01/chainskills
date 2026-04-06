---
name: data-pipeline
version: 1.0.0
domain: tool-use
difficulty: medium
description: "Build a data transformation pipeline"
---

# Step 1 — Raw data
@call shell.exec(echo "{\"users\":[{\"name\":\"alice\",\"score\":85},{\"name\":\"bob\",\"score\":92},{\"name\":\"charlie\",\"score\":78}]}") → $raw

# Step 2 — Transform with agent
@agent copilot Transform this data: uppercase all names, add a grade field (A: 90+, B: 80+, C: 70+), sort by score descending. Return as JSON: $raw → $transformed

# Step 3 — Validate
@call shell.exec(echo "$transformed" | head -1) → $preview

# Step 4 — Output
@output transformed = $transformed
@output preview = $preview
