---
name: schema-migration
domain: data
difficulty: medium
description: Generate database migration for schema change
version: "1.0"
outputs:
  - name: migration
    type: string
---

# Schema Migration

## Step 1 — Generate

@agent copilot
Write a PostgreSQL migration that:
1. Adds a `tags` JSONB column to `articles` table with default []
2. Creates a GIN index on the tags column
3. Adds a `published_at` nullable timestamp column
4. Creates a partial index on published_at WHERE published_at IS NOT NULL
5. Include both UP and DOWN migrations
6. Use transactions

@output migration = $AGENT_RESULT
