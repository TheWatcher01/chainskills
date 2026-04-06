---
name: incident-response
version: 1.0.0
domain: security
difficulty: hard
description: "Create an incident response plan"
---

# Step 1 — Scenario
@call shell.exec(echo "Scenario: Your monitoring detected unusual database queries at 3 AM. Access logs show successful login from an IP in a country where you have no employees. The account used belongs to a developer who left the company 2 months ago.") → $scenario

# Step 2 — Response plan
@agent copilot Create a detailed incident response plan following NIST framework (Preparation, Detection, Containment, Eradication, Recovery, Lessons Learned). Include specific actions, timeline, and communication plan: $scenario → $plan

# Step 3 — Output
@output plan = $plan
