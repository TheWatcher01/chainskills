---
name: add-feature
version: 1.0.0
domain: coding
difficulty: medium
description: "Add a feature to existing code"
---

# Step 1 — Existing code
@call shell.exec(echo "class Stack { constructor() { this.items = []; } push(item) { this.items.push(item); } pop() { return this.items.pop(); } }") → $code

# Step 2 — Add feature
@agent copilot Add a peek() method and a size getter to this Stack class. Return the complete class: $code → $enhanced

# Step 3 — Output
@output enhanced = $enhanced
