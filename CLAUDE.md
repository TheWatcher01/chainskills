# chainskills

TypeScript monorepo for AI workflow orchestration in Markdown (.workflow.md).

## Packages

| Package | Path | Purpose |
|---------|------|---------|
| **cli-mcp-core** | `cli-mcp-core/` | CLI + core library — parsing, execution, MCP server/client |
| **vscode-extension** | `vscode-extension/` | VS Code extension — language features, syntax, CodeLens |

## Build & Test

```bash
pnpm install                           # Dependencies (pnpm only, never npm/yarn)
cd cli-mcp-core && pnpm build          # obuild — 6 bundles
cd cli-mcp-core && pnpm test           # Vitest — 201 tests
cd cli-mcp-core && pnpm typecheck      # tsc --noEmit
cd vscode-extension && pnpm compile    # webpack — 23KB bundle
```

## Architecture — Hexagonal (Ports & Adapters)

```
CLI / Config / Infrastructure
         ↓
Adapters (parser, executor, tools, skills, state, agents, validation, observability)
         ↓
Core (entities, ports, services, use-cases) ← ZERO external deps
```

**Dependency Rule**: dependencies point inward only. Core never imports adapters.

Core = zero npm deps, immutable entities, ports (interfaces), services (pure logic), use cases (`Result<T,E>`).
Adapters = one port each, no domain logic, DI via `src/config/container.ts`.
Subpath imports: `#core/*`, `#adapters/*`, `#cli/*`, `#config/*`, `#infra/*`.

## Conventions

TypeScript strict, ESM, kebab-case files, PascalCase classes, `Result<T,E>` for errors, no `any`, Zod in adapters.

## CLI: `run`, `validate`, `inspect`, `init`, `list`, `serve`

17 directives: `@use @call @if @else @for @repeat @parallel @try @on-error @assert @output @env @workflow @agent @handoff @breakpoint`

MCP server: 5 tools, 2 prompts, stdio or HTTP (port 3001).

