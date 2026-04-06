---
name: multi-criteria-decision
version: 1.0.0
domain: reasoning
difficulty: hard
description: "Multi-criteria decision analysis"
---

# Step 1 — Decision
@call shell.exec(echo "Decision: Choose a cloud provider for deploying our agent benchmark platform. Options: AWS, GCP, Azure, Hetzner. Criteria: cost (weight 30%), GPU availability (25%), developer experience (20%), global reach (15%), vendor lock-in risk (10%). Budget: 500 EUR/month.") → $decision

# Step 2 — Analyze
@agent copilot Perform a weighted multi-criteria decision analysis. Score each option 1-10 on each criterion, compute weighted scores, and determine the winner. Show the decision matrix as a table and explain your reasoning: $decision → $analysis

# Step 3 — Output
@output analysis = $analysis
