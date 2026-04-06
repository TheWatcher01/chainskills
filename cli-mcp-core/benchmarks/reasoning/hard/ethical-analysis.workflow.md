---
name: ethical-analysis
version: 1.0.0
domain: reasoning
difficulty: hard
description: "Analyze ethical implications of AI decisions"
---

# Step 1 — Scenario
@call shell.exec(echo "Scenario: An AI agent benchmark platform automatically ranks LLM models. Concerns: 1) Models from smaller labs may be disadvantaged by benchmark design. 2) Rankings influence purchasing decisions worth millions. 3) Benchmark gaming could emerge. 4) Open-source models vs proprietary models fairness.") → $scenario

# Step 2 — Ethical analysis
@agent copilot Perform an ethical analysis of this scenario. Apply multiple frameworks: Utilitarian, Deontological, Virtue Ethics, and Fairness/Justice. For each concern, identify stakeholders, potential harms, and mitigations. Conclude with ethical design principles: $scenario → $analysis

# Step 3 — Output
@output analysis = $analysis
