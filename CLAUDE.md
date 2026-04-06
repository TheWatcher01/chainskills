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
cd cli-mcp-core && pnpm build          # obuild — 29 bundles, 1.4 MB
cd cli-mcp-core && pnpm test           # Vitest — 388 tests (43 files)
cd cli-mcp-core && pnpm typecheck      # tsc --noEmit
cd vscode-extension && pnpm compile    # webpack — 23KB bundle
```

## Architecture — Hexagonal (Ports & Adapters)

```
CLI / Config / Infrastructure
         ↓
Adapters (parser, executor, tools, skills, state, agents, validation, observability, trace-store, registry, golden, site, export, capture)
         ↓
Core (entities, ports, services, use-cases) ← ZERO external deps
```

**Dependency Rule**: dependencies point inward only. Core never imports adapters.

Core = zero npm deps, immutable entities, ports (interfaces), services (pure logic), use cases (`Result<T,E>`).
Adapters = one port each, no domain logic, DI via `src/config/container.ts`.
Subpath imports: `#core/*`, `#adapters/*`, `#cli/*`, `#config/*`, `#infra/*`.

## Conventions

TypeScript strict, ESM, kebab-case files, PascalCase classes, `Result<T,E>` for errors, no `any`, Zod in adapters.

## CLI (22 commands)

`run`, `validate`, `inspect`, `init`, `list`, `serve`, `replay`, `bench`, `bench-suite`, `distill`, `publish`, `add`, `arena`, `generate`, `leaderboard`, `export-hf`, `import-session`, `compare`, `scorecard`, `route`, `deep-compare`, `explore`

19 directives: `@use @call @if @else @for @repeat @parallel @try @on-error @assert @output @env @workflow @agent @handoff @breakpoint @schema @gate`

MCP server: 7 tools (run, validate, describe, list, inspect, traces, trace_stats), 2 prompts, stdio or HTTP.

## Agent Providers

`AGENT_PROVIDER=anthropic|openai|ollama|noop` — auto-detects from API keys.
- Anthropic: native Messages API (`src/adapters/agents/anthropic-agent.ts`)
- OpenAI: Chat Completions API (`src/adapters/agents/openai-agent.ts`)
- Ollama: OpenAI-compatible, no key needed

## Host Agent Bridge

Capture tool calls from Claude Code / GitHub Copilot CLI — no separate API key needed.
- `import-session`: Parse JSONL transcripts → ExecutionTrace[]
- `compare`: Weighted Jaccard similarity (tools 40%, files 30%, success 20%, steps 10%)
- Hook recorder: `~/.claude/scripts/chainskills-recorder.sh` captures tool_response + agent_id
- Cost reader: Reads real costs from `~/.claude/projects/{path}/config.json`

## Model Router (2D)

Routes tasks to cheapest capable model x effort combination.
- `scorecard`: Model x task-type grid with pass rates
- `route`: Recommends model+effort from historical data
- Cascade: haiku/low → haiku/high → sonnet/medium → opus/high
- Effort multipliers: low=0.4x, medium=0.7x, high=1.0x, max=1.3x

## Reflexion / Explore

Autonomous exploration with anti-loop memory (NeurIPS 2023 + LATS ICML 2024).
- `explore`: Cascades model+effort, injects failure context
- Cycle detection: Jaccard > 0.6 flags repeated approaches
- Graduated scoring: Expert tasks 0-100

## Replay Tasks (16)

3 easy + 3 medium + 2 hard + 8 expert. All accept `WORKSPACE=$1` for parallel isolation.
Real results: Opus 96% vs Haiku 4% on expert tasks.

## Benchmark Suite

100 workflows in `benchmarks/` across 6 domains (coding, data, security, writing, reasoning, tool-use), 3 difficulty levels.
Golden files for deterministic validation.

## Flywheel

execute → trace → replay → bench → arena → distill → generate → leaderboard → export-hf → improve
