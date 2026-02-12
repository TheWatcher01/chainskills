# chainskills

> Compose, share, and run AI agent workflows written in natural language.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org)

**chainskills** is an open source TypeScript CLI that lets you define, compose, share, and execute AI agent workflows written in natural language (`.workflow.md`). It combines the distribution model of [skills.sh](https://skills.sh) (npm-like registry), the DAG orchestration engine of [Mastra](https://mastra.ai), and a Markdown workflow format enriched with lightweight directives (`@use`, `@call`, `@if`, `@for`).

**The "shadcn/ui of AI workflows."**

---

## Features

- **Natural Language Workflows** — Write workflows in Markdown with `@` directives
- **DAG Orchestration** — Sequential, parallel, branching, looping via Mastra
- **MCP Interop** — Connect to any MCP-compatible tool; expose workflows as MCP tools
- **Skills Composable** — Import and chain community skills (`@use skill-name`)
- **CLI-First** — Run, validate, inspect, publish from the terminal
- **Agent Agnostic** — Works with Copilot, Claude, Cursor, or any AI agent
- **Hexagonal Architecture** — Pure domain core, zero external dependencies

---

## Quick Start

```bash
# Install globally
npm i -g chainskills

# Or use npx
npx chainskills run workflow.md

# Initialize a new workflow
chainskills init my-workflow

# Run a workflow
chainskills run my-workflow.workflow.md --input target=example.com

# Validate syntax
chainskills validate my-workflow.workflow.md

# Inspect the DAG
chainskills inspect my-workflow.workflow.md
```

---

## Workflow Format (`.workflow.md`)

```markdown
---
name: code-review-pipeline
description: Automated code review pipeline
version: "1.0.0"
inputs:
  repo_path: string
  branch: string
outputs:
  report: string
  passed: boolean
env:
  - GITHUB_TOKEN
tags: [dev, code-review]
---

@use eslint-analyzer
@use security-scanner
@use test-runner

# Step 1 — Get changed files

@call git.diff($repo_path, "main", $branch) → $changed_files

# Step 2 — Run checks in parallel

@parallel:
  ## Lint
  @call eslint-analyzer.check($changed_files) → $lint

  ## Tests
  @call test-runner.run($repo_path) → $tests

  ## Security
  @call security-scanner.scan($changed_files) → $security

# Step 3 — Evaluate

@if $security.critical_count > 0:
  $passed = false
@else:
  $passed = $lint.error_count == 0 && $tests.passed

@output: $report, $passed
```

---

## Directives

| Directive | Purpose |
|---|---|
| `@use` | Import a skill, tool, or sub-workflow |
| `@call` | Call a tool and capture the result |
| `@if` / `@else` | Conditional branching |
| `@for` | Bounded iteration |
| `@parallel` | Parallel execution |
| `@try` / `@on-error` | Error handling |
| `@assert` | Validation checkpoint |
| `@output` | Declare workflow outputs |
| `@agent` | Delegate to an AI agent |
| `@handoff` | Transfer to another agent |

---

## CLI Commands

```bash
chainskills run <workflow.md>        # Execute a workflow
chainskills validate <workflow.md>   # Check syntax + dependencies
chainskills inspect <workflow.md>    # Display DAG visualization
chainskills init <name>              # Scaffold a new .workflow.md
chainskills list [-g]                # List workflows (local or global)
chainskills add <source> [-g]        # Install from Git/registry
chainskills publish                  # Publish to registry
chainskills serve [--port 3001]      # Expose as MCP server
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

See [.env.example](.env.example) for all available variables.

> **PRODUCTION**: Replace API keys with a Secret Manager (Infisical, Doppler, Vault).

---

## Architecture

Hexagonal Architecture (Ports & Adapters):

```
CLI (Citty) → Core (pure domain) ← Adapters (Remark, Mastra, MCP, Skills)
```

- **Core** (`src/core/`): Entities, use cases, services, ports — zero external dependencies
- **Adapters** (`src/adapters/`): Parser (Remark), Executor (Mastra), Tools (MCP), Skills, State
- **CLI** (`src/cli/`): Commands via Citty
- **Config** (`src/config/`): DI container, env validation

---

## Development

```bash
# Install dependencies
pnpm install

# Run tests (watch mode)
pnpm dev

# Run tests (single run)
pnpm test

# Build
pnpm build

# Lint
pnpm lint

# Type check
pnpm typecheck
```

---

## Stack

| Layer | Package | Role |
|---|---|---|
| CLI | `citty` | Command routing |
| Prompts | `@clack/prompts` | Interactive prompts |
| Frontmatter | `gray-matter` | YAML parsing |
| Markdown | `unified` + `remark-parse` | AST generation |
| Directives | `remark-directive` | `@` directive support |
| Orchestration | `@mastra/core` | DAG workflows |
| MCP | `@modelcontextprotocol/sdk` | Tool interop |
| Validation | `zod` | Typed schemas |
| Build | `obuild` | TypeScript bundling |
| Tests | `vitest` | Unit + integration |

---

## Roadmap

| Phase | Version | Features |
|---|---|---|
| 1 | v0.1.0 | MVP — Parse + sequential run |
| 2 | v0.2.0 | DAG orchestration (Mastra) |
| 3 | v0.3.0 | MCP + Skills integration |
| 4 | v0.4.0 | Registry & distribution |
| 5 | v0.5.0 | Copilot + IDE agents (ACP) |
| 6 | v1.0.0 | Production & scale |

---

## License

[MIT](LICENSE) © TheWatcher01
