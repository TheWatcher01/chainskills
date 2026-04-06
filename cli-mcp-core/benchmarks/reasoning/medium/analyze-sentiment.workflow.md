---
name: analyze-sentiment
version: 1.0.0
domain: reasoning
difficulty: medium
description: "Analyze sentiment across multiple reviews"
---

# Step 1 — Reviews
@call shell.exec(echo "1. Great product, works perfectly! Fast shipping too.\n2. Terrible quality. Broke after 2 days. Want a refund.\n3. It is okay. Does the job but nothing special.\n4. Absolutely love it! Best purchase this year.\n5. The product itself is fine but customer service was awful.") → $reviews

# Step 2 — Analyze
@agent copilot Analyze the sentiment of each review. For each, provide: sentiment (positive/negative/neutral/mixed), confidence score (0-1), key phrases that indicate sentiment, and a brief explanation. Then compute overall statistics. Return as JSON: $reviews → $analysis

# Step 3 — Output
@output analysis = $analysis
