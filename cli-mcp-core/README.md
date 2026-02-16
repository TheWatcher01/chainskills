# chainskills

> Compose, share, and run AI agent workflows written in natural language.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org)

**chainskills** is an open source TypeScript CLI that lets you define, compose, share, and execute AI agent workflows written in natural language (`.workflow.md`). It combines the distribution model of [skills.sh](https://skills.sh) (npm-like registry), the DAG orchestration engine of [Mastra](https://mastra.ai), and a Markdown workflow format enriched with lightweight directives (`@use`, `@call`, `@if`, `@for`).

**The "shadcn/ui of AI workflows."**

---

## Features

### Core Engine

- **Natural Language Workflows** — Write workflows in Markdown with 17 `@` directives
- **DAG Orchestration** — Sequential, parallel, branching, looping via Mastra (auto-parallelization by variable dependency analysis)
- **Full Control Flow** — `@if/@else`, `@for`, `@repeat`, `@try/@on-error`, `@parallel`, `@assert`, `@workflow` (sub-workflows)
- **Dual Executor Strategy** — `SimpleExecutor` (sequential) + `MastraExecutor` (DAG) — switch via `CHAINSKILLS_EXECUTOR` env var
- **Shell Tool Execution** — Security-hardened shell commands via `@call shell.exec()` (binary allowlist, metachar rejection, `execFileSync`)
- **Skills Composable** — Import and chain local skills (`@use ./path`)
- **Hexagonal Architecture** — Pure domain core, zero external dependencies, 8 ports, DI container
- **Result Monad** — `Result<T, E>` pattern with `map`, `flatMap`, `mapErr`, `unwrapOr`, `match` utilities
- **Execution Events** — 11 typed event types with observer pattern (workflow/step/directive/parallel/loop/error)

### MCP & AI

- **MCP Server** — Expose 5 tools + 2 prompts + dynamic resources via `chainskills serve` (stdio + HTTP)
- **MCP Client** — Call remote MCP tools via `@call mcp.*` (lazy connect, tool discovery)
- **Composite Tool Provider** — Extensible routing by namespace (`shell.*`, `mcp.*`)
- **`@agent` / `@handoff`** — Delegate tasks to any OpenAI-compatible AI agent (OpenAI, Anthropic, Ollama, Groq)
- **Noop Agent** — Deterministic stub for tests/dry-run without API key

### Execution Control

- **ExecutionController API** — `pause()`, `resume()`, `cancel()`, `step()` with event listeners
- **CancellationToken** — Graceful cancellation with observer pattern
- **StateStore Serialization** — `serialize()` / `deserialize()` for mid-execution persistence
- **`@breakpoint` Debugging** — Conditional breakpoints for workflow debugging

### CLI

- **6 Commands** — `run`, `validate`, `inspect`, `init`, `list`, `serve`
- **`--format=vscode`** — Problem Matcher output for VS Code integration
- **`--json` Mode** — Machine-readable JSON output for `run` and `validate`
- **`--dry-run`** — Simulate execution without side effects
- **DAG ASCII Visualization** — `inspect` displays DAG with box-drawing characters
- **Event Streaming** — Real-time step/directive/error events during `run`

### VS Code Extension (../vscode-extension)

- **Syntax Highlighting** — TextMate grammar for 17 directives, `$variables`, `:::blocks`
- **Workflow Explorer** — TreeView discovers `.workflow.md` files with frontmatter metadata
- **10 Commands** — Run, Validate, Inspect, Pause, Resume, Stop, Step, Dry Run, Templates, Refresh
- **Auto-validate on Save** — Configurable validation on file save
- **Problem Matcher** — Errors parsed from `--format=vscode` output
- **Execution Control** — Pause/Resume/Cancel via POSIX signals
- **Task Definition** — `chainskills` task type for `tasks.json`

### Coming Soon

- **CodeLens Run/Validate** 🔜 — Clickable "▶ Run | 🔍 Validate" above each step (v0.5.0)
- **Live Diagnostics** 🔜 — Red squiggles for invalid directives as you type (v0.5.0)
- **Autocomplete** 🔜 — `@` → directives, `$` → variables, `@call` → tools (v0.5.0)
- **Copilot Chat** 🔜 — `@chainskills /create` in GitHub Copilot Chat (v0.6.0)
- **Agent Mode Tools** 🔜 — Copilot uses chainskills autonomously (v0.6.0)
- **DAG Webview** 🔜 — Interactive graph visualization (v0.6.0)
- **Debug Adapter** 🔜 — F5 to debug workflows with Variables panel (v0.7.0)
- **Registry** 🔜 — `add`, `publish`, `remove` from npm-like registry (v0.8.0)

---

## Quick Start

```bash
# Clone and build from source (not yet published on npm)
git clone https://github.com/TheWatcher01/chainskills.git
cd chainskills
pnpm install
pnpm build

# Initialize a new workflow
pnpm exec tsx src/cli/index.ts init my-workflow

# Run a workflow
pnpm exec tsx src/cli/index.ts run my-workflow.workflow.md --input target=example.com

# Validate syntax
pnpm exec tsx src/cli/index.ts validate my-workflow.workflow.md

# Inspect the DAG
pnpm exec tsx src/cli/index.ts inspect my-workflow.workflow.md
```

> **Note:** The package is not yet published on npm. Use `pnpm exec tsx src/cli/index.ts` for local development.

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

| Directive            | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| `@use`               | Import a skill, tool, or sub-workflow          |
| `@call`              | Call a tool and capture the result             |
| `@if` / `@else`      | Conditional branching                          |
| `@for`               | Bounded iteration                              |
| `@repeat`            | Loop with stop condition (`max:N until/while`) |
| `@parallel`          | Parallel execution                             |
| `@try` / `@on-error` | Error handling                                 |
| `@assert`            | Validation checkpoint                          |
| `@output`            | Declare workflow outputs                       |
| `@env`               | Reference an environment variable              |
| `@workflow`          | Inline sub-workflow                            |
| `@agent`             | Delegate to an AI agent                        |
| `@handoff`           | Transfer to another agent                      |
| `@breakpoint`        | Conditional debugging breakpoint               |

---

## CLI Commands

```bash
chainskills run <workflow.md>        # Execute a workflow
chainskills validate <workflow.md>   # Check syntax + dependencies
chainskills inspect <workflow.md>    # Display DAG visualization
chainskills init <name>              # Scaffold a new .workflow.md
chainskills list [-g]                # List workflows (local or global)
chainskills add <source> [-g]        # 🔜 Install from Git/registry (v0.8.0)
chainskills publish                  # 🔜 Publish to registry (v0.8.0)
chainskills serve [--port 3001]      # Expose as MCP server (stdio or HTTP)
```

---

## VS Code Extension

The **chainskills vscode** extension (in `../vscode/`) provides IDE integration for `.workflow.md` files:

- **Syntax Highlighting** — TextMate grammar for 17 directives, `$variables`, `:::blocks`
- **Workflow Explorer** — TreeView discovers `.workflow.md` files with frontmatter metadata
- **10 Commands** — Run, Validate, Inspect, Pause, Resume, Stop, Step, Templates, Refresh
- **Auto-validate on Save** — Configurable validation on file save
- **Problem Matcher** — Errors parsed from `--format=vscode` output
- **Execution Control** — Pause/Resume/Cancel via POSIX signals

### Install from source

```bash
cd ../vscode
npm install && npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

> See [vscode/README.md](../vscode-extension/README.md) for full documentation.

### Metrics (v0.4.0)

| Metric     | CLI                        | Extension          |
| ---------- | -------------------------- | ------------------ |
| Tests      | 197/197 passing (17 files) | Manual testing OK  |
| Typecheck  | 0 errors                   | 0 errors           |
| Build      | 5 bundles — 809 KB         | webpack → 23 KB    |
| Source     | ~65 TypeScript files       | 4 TypeScript files |
| Directives | 17 types supported         | 17 highlighted     |
| Ports      | 8 abstract interfaces      | —                  |

> See [FEATURES.md](FEATURES.md) for the complete feature catalog with use cases.

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

### Running CLI from source

```bash
# Run a workflow
pnpm exec tsx src/cli/index.ts run path/to/workflow.md

# Validate a workflow
pnpm exec tsx src/cli/index.ts validate path/to/workflow.md

# Inspect DAG
pnpm exec tsx src/cli/index.ts inspect path/to/workflow.md
```

---

## Stack

| Layer         | Package                     | Role                         |
| ------------- | --------------------------- | ---------------------------- |
| CLI           | `citty`                     | Command routing              |
| Prompts       | `@clack/prompts`            | Interactive prompts          |
| Colors        | `picocolors`                | Console formatting           |
| Frontmatter   | `gray-matter`               | YAML parsing                 |
| Markdown      | `unified` + `remark-parse`  | AST generation               |
| Directives    | `remark-directive`          | `@` directive support        |
| AST traversal | `unist-util-visit`          | Walk/transform AST           |
| Orchestration | `@mastra/core`              | DAG workflows                |
| MCP           | `@modelcontextprotocol/sdk` | Tool interop (server+client) |
| Validation    | `zod`                       | Typed schemas                |
| Build         | `obuild`                    | TypeScript bundling          |
| Tests         | `vitest`                    | Unit + integration           |

---

## Roadmap

| Phase | Version | Features                                                         | Status |
| ----- | ------- | ---------------------------------------------------------------- | ------ |
| 1     | v0.1.0  | MVP — Parse + sequential run + CLI + 86 tests                    | ✅     |
| 2     | v0.2.0  | DAG orchestration (Mastra), full control flow, event system      | ✅     |
| 2.1   | v0.2.1  | Security hardening, Result monad utilities, architecture fixes   | ✅     |
| 3     | v0.3.0  | MCP server/client, `@agent` LLM, composite tools, SDK API        | ✅     |
| 4     | v0.4.0  | VS Code extension skeleton, ExecutionController, `@breakpoint`   | ✅     |
| 5     | v0.5.0  | IDE Language Features (CodeLens, Completion, Hover, Diagnostics) | 🔄     |
| 6     | v0.6.0  | Copilot Chat `@chainskills`, Agent Mode tools, DAG Webview       | ⏳     |
| 7     | v0.7.0  | Debug Adapter (DAP), Test Controller, Rename/References          | ⏳     |
| 8     | v0.8.0  | Registry & distribution                                          | ⏳     |
| 9     | v0.9.0  | Polish, integration tests, marketplace publish                   | ⏳     |
| 10    | v1.0.0  | Production & scale (SQLite, Redis, enterprise)                   | ⏳     |

---

## License

[MIT](LICENSE) © TheWatcher01
