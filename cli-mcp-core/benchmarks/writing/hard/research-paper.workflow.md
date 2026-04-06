---
name: research-paper
version: 1.0.0
domain: writing
difficulty: hard
description: "Draft a research paper abstract and outline"
---

# Step 1 — Research topic
@call shell.exec(echo "Topic: Cross-domain evaluation of AI agents using standardized workflow benchmarks. Contribution: A framework that evaluates LLM agents across 6 domains (coding, data, security, writing, reasoning, tool-use) with reproducible benchmarks and Elo-based ranking.") → $topic

# Step 2 — Abstract
@agent writer Write a 200-word research paper abstract following ACL format. Include: motivation, gap in existing work, proposed approach, key results (hypothetical), and significance: $topic → $abstract

# Step 3 — Outline
@agent writer Create a detailed paper outline with section headings and 2-3 bullet points per section. Include: Introduction, Related Work, Methodology, Experimental Setup, Results, Discussion, Conclusion: $topic → $outline

# Step 4 — Output
@output abstract = $abstract
@output outline = $outline
