---
name: parallel-tools
version: 1.0.0
domain: tool-use
difficulty: hard
description: "Execute tools in parallel and merge results"
---

# Step 1 — Parallel execution
@parallel
@call shell.exec(echo "System: $(uname -s) $(uname -r)") → $system
@call shell.exec(echo "Memory: $(free -h 2>/dev/null || echo "N/A")") → $memory
@call shell.exec(echo "Disk: $(df -h / 2>/dev/null | tail -1 || echo "N/A")") → $disk

# Step 2 — Merge results
@agent copilot Create a system health report from these parallel results. Assess overall health (healthy/warning/critical) and flag any concerns. System: $system Memory: $memory Disk: $disk → $report

# Step 3 — Output
@output report = $report
