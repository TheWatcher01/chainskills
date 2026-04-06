---
name: refactor-function
version: 1.0.0
domain: coding
difficulty: medium
description: "Refactor a function to be more readable"
---

# Step 1 — Messy code
@call shell.exec(echo "function p(d){var r=[];for(var i=0;i<d.length;i++){if(d[i]>0){r.push(d[i]*2)}}return r}") → $code

# Step 2 — Refactor
@agent copilot Refactor this function for clarity: use descriptive names, modern JS syntax, and add JSDoc. Return only the code: $code → $refactored

# Step 3 — Validate
@agent reviewer Does this refactored code preserve the original behavior? Answer YES or NO with explanation: Original: $code Refactored: $refactored → $validation

# Step 4 — Output
@output refactored = $refactored
@output validation = $validation
