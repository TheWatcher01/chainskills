---
name: sql-query
domain: data
difficulty: medium
description: Generate SQL for multi-table join with aggregation
version: "1.0"
outputs:
  - name: query
    type: string
  - name: review
    type: string
---

# SQL Query Builder

## Step 1 — Generate

@agent copilot
Write a PostgreSQL query that:
- Joins tables: orders(id, user_id, total, created_at), users(id, name, email), products(id, order_id, name, price)
- Shows top 10 users by total spending in the last 30 days
- Include user name, email, order count, and total amount
- Use CTEs for clarity

@output query = $AGENT_RESULT

## Step 2 — Review

@agent reviewer
Review this SQL query for performance, correctness, and SQL injection safety:
$query

@output review = $AGENT_RESULT
