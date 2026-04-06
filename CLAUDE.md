# chainskills

TypeScript monorepo — cross-domain AI agent evaluation framework ("Chatbot Arena for agents").

## Packages

| Package | Path | Purpose |
|---------|------|---------|
| **cli-mcp-core** | `cli-mcp-core/` | CLI + core library — parsing, execution, MCP server/client, benchmarking |
| **vscode-extension** | `vscode-extension/` | VS Code extension — language features, syntax, CodeLens |

## Build & Test

```bash
pnpm install                           # Dependencies (pnpm only, never npm/yarn)
cd cli-mcp-core && pnpm build          # obuild — 29 bundles, 1.35 MB
cd cli-mcp-core && pnpm test           # Vitest — 388+ tests
cd cli-mcp-core && pnpm typecheck      # tsc --noEmit
cd vscode-extension && pnpm compile    # webpack — 23KB bundle
```

## Architecture — Hexagonal (Ports & Adapters)

```
CLI / Config / Infrastructure
         ↓
Adapters (parser, executor, tools, skills, state, agents, validation, observability, trace-store, registry, golden, site, export)
         ↓
Core (entities, ports, services, use-cases) ← ZERO external deps
```

**Dependency Rule**: dependencies point inward only. Core never imports adapters.

Core = zero npm deps, immutable entities, ports (interfaces), services (pure logic), use cases (`Result<T,E>`).
Adapters = one port each, no domain logic, DI via `src/config/container.ts`.
Subpath imports: `#core/*`, `#adapters/*`, `#cli/*`, `#config/*`, `#infra/*`.

## Conventions

TypeScript strict, ESM, kebab-case files, PascalCase classes, `Result<T,E>` for errors, no `any`, Zod in adapters.

## CLI (17 commands)

`run`, `validate`, `inspect`, `init`, `list`, `serve`, `replay`, `bench`, `bench-suite`, `distill`, `publish`, `add`, `arena`, `generate`, `leaderboard`, `export-hf`

19 directives: `@use @call @if @else @for @repeat @parallel @try @on-error @assert @output @env @workflow @agent @handoff @breakpoint @schema @gate`

MCP server: 7 tools (run, validate, describe, list, inspect, traces, trace_stats), 2 prompts, stdio or HTTP.

## Agent Providers

`AGENT_PROVIDER=anthropic|openai|ollama|noop` — auto-detects from API keys.
- Anthropic: native Messages API (`src/adapters/agents/anthropic-agent.ts`)
- OpenAI: Chat Completions API (`src/adapters/agents/openai-agent.ts`)
- Ollama: OpenAI-compatible, no key needed

## Benchmark Suite

100 workflows in `benchmarks/` across 6 domains (coding, data, security, writing, reasoning, tool-use), 3 difficulty levels.
Golden files for deterministic validation.

## Flywheel

execute → trace (CRAG/KG) → replay (model switch) → bench (multi-model) → arena (Elo vote) → distill (fine-tuning JSONL) → feedback (few-shot injection) → generate (workflow variants) → leaderboard → export-hf → improve
