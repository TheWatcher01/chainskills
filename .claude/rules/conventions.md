# Conventions — chainskills

## TypeScript

- Strict mode, ESM only, no CommonJS
- kebab-case files, PascalCase classes/interfaces, camelCase functions
- No `any` — use `unknown` and narrow
- Subpath imports: `#core/*`, `#adapters/*`, `#cli/*`, `#config/*`, `#infra/*`

## Error Handling

- `Result<T, E>` monad for all business logic
- `tryAsync()` for wrapping Promise into Result
- Never `throw` except for truly unrecoverable programmer errors
- Adapters wrap external errors into domain error types

## Testing (Vitest)

- Unit tests: `tests/unit/` — core entities, infrastructure
- Integration tests: `tests/parser/`, `tests/runtime/`, `tests/mcp/`, `tests/agent/`
- CLI tests: `tests/cli/`
- Pure functions get unit tests. Adapters get integration tests.
- No mocks for core domain logic.

## CLI (Citty)

- One file per command in `src/cli/`
- All deps via DI container
- Exit codes: 0 success, 1 validation error, 2 runtime error

## VS Code Extension

- Disposable pattern for all subscriptions
- WorkflowDocument cache for AST sharing across providers
- webpack bundle target
- Async APIs only — never block the extension host
