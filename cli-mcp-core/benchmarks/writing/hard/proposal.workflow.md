---
name: proposal
version: 1.0.0
domain: writing
difficulty: hard
description: "Write a technical proposal"
---

# Step 1 — Context
@call shell.exec(echo "Proposal: Open-source agent evaluation platform. Audience: AI research labs. Goal: Convince labs to adopt our benchmark suite as the standard for agent evaluation. Budget: $0 (open-source). Timeline: 6 months to v1.0.") → $context

# Step 2 — Write proposal
@agent writer Write a 500-word technical proposal. Include: Executive Summary, Problem Statement (no standard for agent evaluation), Proposed Solution, Technical Approach, Timeline & Milestones, Expected Impact, and Call to Action. Professional and persuasive tone: $context → $proposal

# Step 3 — Output
@output proposal = $proposal
