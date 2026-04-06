---
name: fix-typo
version: 1.0.0
domain: coding
difficulty: easy
description: "Fix a typo in a code string"
---

# Step 1 — Source with typo
@call shell.exec(echo "fucntion hello() { return \"world\"; }") → $source

# Step 2 — Fix
@agent copilot Fix any typos in this code. Return only the corrected code: $source → $fixed

# Step 3 — Output
@output fixed = $fixed
