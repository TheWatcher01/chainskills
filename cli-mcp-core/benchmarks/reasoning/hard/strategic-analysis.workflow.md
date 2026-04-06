---
name: strategic-analysis
version: 1.0.0
domain: reasoning
difficulty: hard
description: "Perform a strategic business analysis"
---

# Step 1 — Context
@call shell.exec(echo "Company: Open-source AI tools startup. Product: Agent workflow framework. Competitors: LangChain, CrewAI, AutoGen. Strengths: Markdown-native, no-code friendly, built-in benchmarking. Revenue: $0 (pre-revenue). Users: 500 GitHub stars.") → $context

# Step 2 — SWOT
@agent copilot Perform a SWOT analysis (Strengths, Weaknesses, Opportunities, Threats). Then create a strategic roadmap with 3 phases (6mo/12mo/24mo). Include: key metrics, milestones, and revenue strategy: $context → $swot

# Step 3 — Competitive moat
@agent copilot Based on this context, what is the most defensible competitive moat? Analyze network effects, switching costs, data advantages, and ecosystem lock-in. Provide 3 specific strategies: $context → $moat

# Step 4 — Output
@output swot = $swot
@output moat = $moat
