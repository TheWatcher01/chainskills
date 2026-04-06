---
name: optimize-algorithm
version: 1.0.0
domain: coding
difficulty: hard
description: "Optimize an inefficient algorithm"
---

# Step 1 — Slow code
@call shell.exec(echo "function findDuplicates(arr) { const dupes = []; for (let i = 0; i < arr.length; i++) { for (let j = i + 1; j < arr.length; j++) { if (arr[i] === arr[j] && !dupes.includes(arr[i])) dupes.push(arr[i]); } } return dupes; }") → $slow

# Step 2 — Optimize
@agent copilot Optimize this O(n^3) function to O(n). Explain the optimization and provide the code: $slow → $optimized

# Step 3 — Verify
@agent reviewer Verify the optimized version is correct and truly O(n). Analyze the time and space complexity: $optimized → $analysis

# Step 4 — Output
@output optimized = $optimized
@output analysis = $analysis
