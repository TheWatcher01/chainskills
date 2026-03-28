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

### Core Domain (`src/core/`)
- ZERO npm imports. Only TypeScript builtins.
- Entities: immutable (readonly props), value objects.
- Ports: interfaces only — define what adapters must implement.
- Services: pure domain logic (template engine, condition parser).
- Use cases: orchestration returning `Result<T, E>`.

### Adapters (`src/adapters/`)
- Implement exactly one port each.
- No domain logic — translation layer only.
- Can import npm packages and core types (interfaces only).
- Registered via DI container (`src/config/container.ts`).

### Subpath Imports
```
#core/*     → src/core/*
#adapters/* → src/adapters/*
#cli/*      → src/cli/*
#config/*   → src/config/*
#infra/*    → src/infrastructure/*
```

## Conventions

- TypeScript strict, ESM only, no CommonJS
- kebab-case files, PascalCase classes, camelCase functions
- `Result<T, E>` pattern for errors — never `throw` for business logic
- Strong typing: no `any`, prefer `unknown`
- Config via env vars (Zod validated in `src/config/env.ts`)
- Secrets never in code or git

## Key Environment Variables

```
CHAINSKILLS_EXECUTOR=simple|mastra    # DAG backend
CHAINSKILLS_LOG_LEVEL=debug|info|warn|error
CHAINSKILLS_WORKFLOWS_DIR=./workflows
MCP_SERVER_PORT=3001
MCP_TRANSPORT=stdio|http
AGENT_API_KEY=                        # OpenAI-compatible
AGENT_BASE_URL=                       # LLM endpoint
AGENT_MODEL=                          # Model ID
```

## CLI Commands

```bash
chainskills run <file.workflow.md>      # Execute workflow
chainskills validate <file.workflow.md> # Validate syntax + structure
chainskills inspect <file.workflow.md>  # DAG ASCII visualization
chainskills init <name>                 # Scaffold new workflow
chainskills list [dir]                  # Discover workflows
chainskills serve [--port 3001]         # Start MCP server
```

## Workflow Directives (17)

`@use`, `@call`, `@if`/`@else`, `@for`, `@repeat`, `@parallel`, `@try`/`@on-error`, `@assert`, `@output`, `@env`, `@workflow`, `@agent`, `@handoff`, `@breakpoint`

## MCP Server

Exposes 5 tools (run, validate, describe, list, inspect), 2 prompts, dynamic resources. Transports: stdio (default) or streamable HTTP.

## Data Quality (ISO 8000-8)

All external data must carry provenance:
```typescript
{ source_name, source_url, source_updated_at, ingested_at,
  confidence_score, confidence_reason, verification_status }
```
9 dimensions: validity, accuracy, reliability, freshness, completeness, coherence, uniqueness, structure, traceability.
