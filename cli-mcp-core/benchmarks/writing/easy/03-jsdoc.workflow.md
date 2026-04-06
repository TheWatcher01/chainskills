---
name: jsdoc-generator
domain: writing
difficulty: easy
description: Generate JSDoc for a TypeScript function
version: "1.0"
outputs:
  - name: docs
    type: string
---

# JSDoc Generator

## Step 1 — Generate

@agent writer
Write complete JSDoc documentation for this TypeScript function:
```typescript
async function fetchPaginatedData<T>(
  url: string,
  pageSize: number,
  transform?: (item: unknown) => T,
  signal?: AbortSignal
): Promise<{ data: T[]; total: number; pages: number }>
```
Include @param, @returns, @throws, @example with realistic usage.

@output docs = $AGENT_RESULT
