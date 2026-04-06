---
name: type-error-fix
domain: reasoning
difficulty: easy
description: Fix TypeScript type errors
version: "1.0"
outputs:
  - name: fixed
    type: string
---

# Type Error Fix

## Step 1 — Fix

@agent copilot
Fix all TypeScript type errors in this code (don't use `any`):
```typescript
interface User {
  id: number;
  name: string;
  email: string;
  roles: string[];
}

function getUser(id: string): User {
  return fetch(`/api/users/${id}`).then(r => r.json());
}

function isAdmin(user: User): boolean {
  return user.roles.includes('admin') || user.roles.includes('superadmin');
}

const user = getUser(123);
if (isAdmin(user)) {
  console.log(`Admin: ${user.name}`);
}
```

@output fixed = $AGENT_RESULT
