# AGENTS.md — cli-mcp-core

> Project-specific context for the CLI + Core library package.
> Shared agents & monorepo index → [../../AGENTS.md](../../AGENTS.md)

## Package

**cli-mcp-core** is the TypeScript CLI + core library of chainskills — parses `.workflow.md` files, executes them as Mastra DAG workflows, exposes an MCP server, and provides a public API consumed by the VS Code extension.

| Key | Value |
|-----|-------|
| **Language** | TypeScript (strict) — Node.js ≥ 20 |
| **CLI** | Citty ^0.2.1 |
| **Orchestration** | Mastra DAG (.then/.parallel/.branch/.foreach) |
| **Parsing** | unified + remark-parse + remark-directive + gray-matter |
| **MCP** | @modelcontextprotocol/sdk — 5 tools, 2 prompts |
| **Validation** | Zod ^3.25 |
| **Tests** | Vitest ^4.0 (197 tests) |
| **Build** | obuild ^0.4.22 (Rolldown) — 5 bundles, 770 KB |
| **Package manager** | pnpm |
| **Architecture** | Hexagonal (Ports & Adapters) |

---

## Architecture

```
src/
├── core/            ← Pure domain: entities, use-cases, services, ports (ZERO external deps)
│   ├── entities/    ← Workflow, Step, Directive, Variable (readonly, immutable)
│   ├── use-cases/   ← parse-workflow, build-dag, validate-workflow, resolve-imports
│   ├── services/    ← template-engine, condition-parser
│   └── ports/       ← Interfaces only: WorkflowParser, WorkflowExecutor, SkillResolver…
├── adapters/        ← Concrete implementations (can import from npm)
│   ├── parser/      ← remark + plugins for @ directives
│   ├── executor/    ← Mastra DAG + simple sequential fallback
│   ├── tools/       ← MCP client/server, shell tool
│   ├── skills/      ← local resolver, git registry
│   ├── agents/      ← OpenAI agent adapter
│   └── state/       ← memory store (dev), ready for SQLite/Redis
├── cli/             ← Citty commands (run, validate, init, inspect, list, serve)
├── config/          ← DI container, env validation, defaults
└── infrastructure/  ← Logger (structured JSON), event emitter, errors
```

---

## Key Architecture Rules

1. **Dependency Rule** — `src/core/` has ZERO external imports. Only `src/core/` imports allowed.
2. **Result pattern** — Use cases return `Result<T, E>`, never `throw` for business logic.
3. **Ports = interfaces** — `src/core/ports/` contains ONLY interfaces, never implementations.
4. **DI only** — Adapters instantiated only in `src/config/container.ts`, injected everywhere else.
5. **ESM only** — No CommonJS, no `require()`.

---

## `.workflow.md` Format

```markdown
---                          # Frontmatter YAML (required)
name: my-workflow
description: What it does
version: "1.0.0"
inputs: [target, mode]
outputs: [report]
env: [API_KEY]
tags: [dev, research]
---

## Step 1 — Title      ← H2 heading = step boundary

Step description in natural language.

@use my-skill            ← load a skill
@call tool-name arg      ← call a tool
@if $mode == "fast"      ← conditional
@for $item in $list      ← loop
:::parallel              ← parallel block
  @call tool-a
  @call tool-b
:::
@assert $result != null  ← assertion
@output result $report   ← capture output
```

---

## CLI Commands

```bash
chainskills run <workflow>       # Execute a .workflow.md
chainskills validate <workflow>  # Validate without running
chainskills inspect <workflow>   # Show parsed AST + DAG
chainskills list [dir]           # List available workflows
chainskills serve [--port]       # Start MCP server (HTTP/stdio)
chainskills init [name]          # Create a new workflow
```

---

## Project-Local Skills (`.github/skills/`)

| Skill | Purpose |
|-------|---------|
| **smart** | Auto-learning from chainskills development errors |
| **smart-commit** | Grouped commits with CLI-specific scopes |
| **research** | Multi-source research protocol for this project |

---

## Project-Local Prompts (`.github/prompts/`)

| Prompt | Agent | Purpose |
|--------|-------|---------|
| **smart-commit** | agent | CLI-specific scopes: core, parser, executor, mcp, cli |
| **smart-review** | Review | Hexagonal compliance + code quality |
| **chainskills-plan** | agent | Complete project blueprint (491 lines) |

---

## Path-Specific Instructions (`.github/instructions/`)

| Pattern | File | Purpose |
|---------|------|---------|
| `src/core/**` | [core.instructions.md](instructions/core.instructions.md) | Zero deps, Result pattern, immutability |
| `src/cli/**` | [cli.instructions.md](instructions/cli.instructions.md) | Citty conventions, one-file-per-command, DI |

Cross-package instructions (adapters, tests) → [../../.github/instructions/](../../.github/instructions/)

---

## MCP Server

**Configuration**: `.vscode/mcp.json` → auto-discovered by GitHub Copilot

```json
{ "servers": { "chainskills": { "type": "stdio", "command": "node",
  "args": ["./bin/cli.mjs", "serve", "--stdio"] } } }
```

**5 tools**: `run_workflow`, `validate_workflow`, `list_workflows`, `inspect_workflow`, `get_skill`
**2 prompts**: `create_workflow`, `workflow_best_practices`

---

## Build & Test

```bash
pnpm build      # obuild → dist/ (5 bundles, 770 KB)
pnpm test       # Vitest (197 tests across 14 files)
pnpm lint       # ESLint
pnpm exec tsc --noEmit  # Type check
```

---

## Roadmap

**Canonical**: [ROADMAP.md](ROADMAP.md) (811 lines — phases, checkboxes, changelog, decisions)

| Phase | Version | Status |
|-------|---------|--------|
| 1–5 | v0.1.0–v0.5.0 | ✅ All completed |
| 6 | v0.6.0 | 🔄 En cours — Copilot Chat + Agent Mode |
| 7 | v0.7.0 | ⏳ Planifié — Debug Adapter + Test Controller |
| 8+ | v0.8.0+ | ⏳ Planifié — Registry + Community |
