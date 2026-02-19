---
description: Instructions for chainskills tests — Vitest conventions, no infra deps for unit tests, integration tests for adapters
applyTo: "**/tests/**"
---

# Test Instructions — chainskills

## Framework: Vitest

All tests use [Vitest](https://vitest.dev/) (`pnpm test` in `cli-mcp-core/`).

## Rules

1. **Unit tests (core)** — Must compile and pass **without any infrastructure** (no DB, no network, no filesystem). Test domain logic only.
2. **Integration tests (adapters)** — May use real or mock external systems. Placed in `tests/` subdirs matching adapter category.
3. **No cross-layer leaks** — Unit tests don't import from adapters. Integration tests may import from adapters + core.
4. **Fixtures** — Static test data goes in `tests/__fixtures__/` or co-located `{test-name}.fixture.ts`.
5. **Descriptive naming** — Test files: `{subject}.test.ts`. Describe: module name. It: behavior description.

## Structure

```typescript
// tests/{category}/{subject}.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { myFunction } from "#core/use-cases/my-use-case.js";

describe("myFunction", () => {
  describe("when input is valid", () => {
    it("should return success result", () => {
      const result = myFunction({ name: "test" });
      expect(result.ok).toBe(true);
      expect(result.value).toMatchObject({ name: "test" });
    });
  });

  describe("when input is invalid", () => {
    it("should return error result", () => {
      const result = myFunction({ name: "" });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("INVALID_NAME");
    });
  });
});
```

## Test Directories

```
tests/
├── unit/           ← core entities, services (pure, no infra)
├── parser/         ← remark adapter tests (require unified/remark)
├── runtime/        ← executor tests (use-case level, mocked infra)
├── mcp/            ← MCP client/server integration tests
├── cli/            ← CLI command tests
└── agent/          ← Agent provider tests
```

## Anti-patterns

- ❌ `new MyDatabaseAdapter()` in a unit test
- ❌ `fetch()` real URLs in unit tests (mock with `vi.mock()` or `vi.fn()`)
- ❌ `process.env.MY_VAR = 'real-secret'` — use test-specific env values
- ❌ Tests that depend on execution order
- ❌ `describe` without `it` (empty suites)
- ❌ `it.only` left in committed code

## Result Pattern in Tests

```typescript
// Always check .ok before accessing .value or .error
const result = parseWorkflow(source);
expect(result.ok).toBe(true);
if (result.ok) {
  expect(result.value.name).toBe("expected");
}
```

## Running Tests

```bash
cd cli-mcp-core
pnpm test          # run once
pnpm dev           # watch mode (vitest watch)
```
