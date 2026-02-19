---
description: Instructions for chainskills adapter implementations — ports & adapters pattern, DI, no domain logic
applyTo: "cli-mcp-core/src/adapters/**"
---

# Adapter Instructions — chainskills

## Purpose

Files in `src/adapters/` are **concrete implementations** of ports defined in `src/core/ports/`.
They adapt external libraries and systems to the domain's interfaces.

## Rules

1. **Implement exactly one port** — Each adapter file implements one specific port interface from `src/core/ports/`.
2. **No domain logic** — Adapters translate data between external and domain formats. Business rules live in `src/core/`.
3. **DI only** — Adapters are never instantiated directly in `src/cli/` or `src/core/`. They are registered in `src/config/container.ts` and injected via DI.
4. **Imports allowed** — Adapters can import from `npm`, `src/core/` (types/interfaces), and `src/infrastructure/`. Never import from other adapters directly.
5. **Error wrapping** — Wrap external errors into domain error types. Return `Result<T, E>` matching the port contract.

## Structure

```typescript
// src/adapters/{category}/{name}.ts
import type { MyPort } from "#core/ports/my-port.js";
import type { Result } from "#core/entities/result.js";
import { externalLib } from "external-lib";

export class MyAdapter implements MyPort {
  async doSomething(input: Input): Promise<Result<Output, MyError>> {
    try {
      const result = await externalLib.call(input);
      return { ok: true, value: mapToOutputDomain(result) };
    } catch (err) {
      return { ok: false, error: wrapError(err) };
    }
  }
}
```

## Anti-patterns

- ❌ Business rules in an adapter (`if (price > 100) { applyDiscount() }`)
- ❌ Direct instantiation: `new MyAdapter()` in CLI commands
- ❌ Adapter importing from another adapter
- ❌ `throw` for expected errors — use `Result`
- ❌ External library types leaking into return types (map to domain types)

## Testing

Adapters require **integration tests** (can use real external systems in controlled env or mocks):

```typescript
// tests/adapters/my-adapter.test.ts
import { MyAdapter } from "#adapters/category/my-adapter.js";

describe("MyAdapter", () => {
  it("should map external response to domain type", async () => {
    const adapter = new MyAdapter(mockConfig);
    const result = await adapter.doSomething(testInput);
    expect(result.ok).toBe(true);
  });
});
```
