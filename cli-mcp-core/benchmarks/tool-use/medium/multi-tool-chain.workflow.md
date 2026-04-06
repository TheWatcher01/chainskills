---
name: multi-tool-chain
version: 1.0.0
domain: tool-use
difficulty: medium
description: "Chain multiple tools together"
---

# Step 1 — Generate data
@call shell.exec(echo "Alice,30\nBob,25\nCharlie,35\nDiana,28" > /tmp/cs-bench-data.csv && echo "Data written") → $status

# Step 2 — Process with shell
@call shell.exec(cat /tmp/cs-bench-data.csv | sort -t, -k2 -n) → $sorted

# Step 3 — Agent analysis
@agent copilot Analyze this sorted CSV data. Who is the youngest? Who is the oldest? What is the average age? Answer in one line each: $sorted → $analysis

# Step 4 — Cleanup
@call shell.exec(rm -f /tmp/cs-bench-data.csv && echo "Cleaned up") → $cleanup

# Step 5 — Output
@output sorted = $sorted
@output analysis = $analysis
