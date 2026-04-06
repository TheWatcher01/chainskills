---
name: architect-system
version: 1.0.0
domain: coding
difficulty: hard
description: "Design a system architecture"
---

# Step 1 — Requirements
@call shell.exec(echo "Build a URL shortener that handles 10K requests/sec, stores links in a database, tracks click analytics, and expires links after 30 days.") → $requirements

# Step 2 — Architecture
@agent copilot Design a system architecture for these requirements. Include: components, data flow, database schema, API endpoints, and scaling strategy. Format as structured markdown: $requirements → $architecture

# Step 3 — Review
@agent reviewer Review this architecture for potential bottlenecks, single points of failure, and security concerns: $architecture → $review

# Step 4 — Output
@output architecture = $architecture
@output review = $review
