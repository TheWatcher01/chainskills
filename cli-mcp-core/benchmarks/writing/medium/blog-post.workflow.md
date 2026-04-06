---
name: blog-post
version: 1.0.0
domain: writing
difficulty: medium
description: "Write a technical blog post"
---

# Step 1 — Topic
@call shell.exec(echo "Topic: Why every team should benchmark their AI agents. Key points: reproducibility matters, different models excel at different tasks, cost vs quality tradeoffs, the importance of standardized evaluation.") → $topic

# Step 2 — Write
@agent writer Write a 300-word technical blog post on this topic. Include: engaging title, introduction, 3-4 key sections, and a conclusion with call-to-action. Professional tone: $topic → $post

# Step 3 — Output
@output post = $post
