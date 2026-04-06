---
name: aggregate-stats
version: 1.0.0
domain: data
difficulty: medium
description: "Compute statistical aggregations"
---

# Step 1 — Sales data
@call shell.exec(echo "date,product,amount,region\n2026-01-01,A,100,North\n2026-01-01,B,200,South\n2026-01-02,A,150,North\n2026-01-02,A,75,South\n2026-01-03,B,300,North") → $sales

# Step 2 — Aggregate
@agent copilot Compute: total sales by product, total sales by region, daily averages, and the best-selling product. Format as JSON: $sales → $stats

# Step 3 — Output
@output stats = $stats
