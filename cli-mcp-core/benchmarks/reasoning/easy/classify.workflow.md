---
name: classify
version: 1.0.0
domain: reasoning
difficulty: easy
description: "Classify items into categories"
---

# Step 1 — Items
@call shell.exec(echo "1. Docker container crashed\n2. Customer wants refund\n3. Login page returns 500\n4. Feature request: dark mode\n5. Database backup failed\n6. Billing question\n7. API rate limit exceeded\n8. Password reset not working") → $items

# Step 2 — Classify
@agent copilot Classify each item into one of: Bug, Feature Request, Customer Support, Infrastructure. Return as JSON array with {id, text, category, confidence}: $items → $classified

# Step 3 — Output
@output classified = $classified
