---
name: dependency-analysis
domain: reasoning
difficulty: medium
description: Analyze dependency graph for circular imports
version: "1.0"
outputs:
  - name: analysis
    type: string
---

# Dependency Analysis

## Step 1 — Analyze

@agent reviewer
Analyze this module dependency graph and identify problems:
```
auth.ts → user.ts → permissions.ts → auth.ts (circular!)
api.ts → auth.ts, user.ts, db.ts
db.ts → config.ts
config.ts → (no deps)
middleware.ts → auth.ts, logger.ts
logger.ts → config.ts
user.ts → db.ts, permissions.ts
permissions.ts → db.ts, auth.ts
```
1. List all circular dependency chains
2. Explain why each is problematic
3. Propose a refactoring plan to break cycles
4. Draw the correct dependency order (topological sort)

@output analysis = $AGENT_RESULT
