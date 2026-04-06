---
name: bug-find
domain: reasoning
difficulty: easy
description: Find the bug in a simple function
version: "1.0"
outputs:
  - name: bug
    type: string
---

# Bug Finder

## Step 1 — Analyze

@agent reviewer
Find the bug in this JavaScript function and explain why it fails:
```javascript
function removeDuplicates(arr) {
  const seen = {};
  return arr.filter(item => {
    if (seen[item]) return false;
    seen[item] = true;
    return true;
  });
}
// Fails for: removeDuplicates([0, 1, 0, 2, 0])
// Returns [0, 1, 2] but should work... or does it return [1, 2]?
```

@output bug = $AGENT_RESULT
