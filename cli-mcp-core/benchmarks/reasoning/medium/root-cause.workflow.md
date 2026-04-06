---
name: root-cause
version: 1.0.0
domain: reasoning
difficulty: medium
description: "Perform root cause analysis"
---

# Step 1 — Incident
@call shell.exec(echo "Incident: API response times increased from 50ms to 2000ms at 2PM. Timeline: 1:30 PM - deployed new version. 1:45 PM - connection pool warnings. 2:00 PM - p99 latency spiked. 2:15 PM - database CPU at 95%. 2:30 PM - rolled back, latency normalized in 5 min.") → $incident

# Step 2 — Analyze
@agent copilot Perform a root cause analysis using the 5 Whys technique. Identify: the root cause, contributing factors, immediate vs systemic causes, and preventive measures. Format as structured report: $incident → $rca

# Step 3 — Output
@output rca = $rca
