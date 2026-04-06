---
name: query-optimizer
domain: data
difficulty: hard
description: SQL query optimizer suggestions
version: "1.0"
outputs:
  - name: analysis
    type: string
  - name: optimized
    type: string
---

# Query Optimizer

## Step 1 — Analyze

@agent reviewer
Analyze this slow PostgreSQL query and identify performance issues:
```sql
SELECT u.*, COUNT(o.id), SUM(o.total)
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at > NOW() - INTERVAL '1 year'
AND u.status = 'active'
GROUP BY u.id
HAVING SUM(o.total) > 1000
ORDER BY SUM(o.total) DESC;
```
List all issues: missing indexes, full table scans, N+1 patterns.

@output analysis = $AGENT_RESULT

## Step 2 — Optimize

@agent copilot
Based on this analysis, rewrite the query optimally and suggest CREATE INDEX statements:
$analysis

@output optimized = $AGENT_RESULT
