---
name: convert-format
version: 1.0.0
domain: coding
difficulty: medium
description: "Convert code between formats"
---

# Step 1 — JS code
@call shell.exec(echo "const greet = (name) => { return \"Hello, \" + name + \"!\"; };") → $js

# Step 2 — Convert to TypeScript
@agent copilot Convert this JavaScript to TypeScript with proper type annotations. Return only the code: $js → $ts

# Step 3 — Output
@output typescript = $ts
