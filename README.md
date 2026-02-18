# chainskills

> The "shadcn/ui of AI workflows" — compose, share, and run AI agent workflows written in natural language.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](cli-mcp-core/LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-197%2F197%20passing-brightgreen.svg)](cli-mcp-core/tests)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple.svg)](https://modelcontextprotocol.io)

**chainskills** is an open source TypeScript CLI that lets you define, compose, share, and execute AI agent workflows written in natural language (`.workflow.md`). It combines the distribution model of [skills.sh](https://skills.sh) (npm-like registry), the DAG orchestration engine of [Mastra](https://mastra.ai), and a Markdown workflow format enriched with 17 lightweight directives.

```markdown
---
name: code-review-pipeline
inputs: { repo_path: string, branch: string }
---

@use eslint-analyzer
@use security-scanner

# Step 1 — Get changed files

@call git.diff($repo_path, "main", $branch) → $changed_files

# Step 2 — Check everything in parallel

@parallel:

## Lint

@call eslint-analyzer.check($changed_files) → $lint

## Security

@call security-scanner.scan($changed_files) → $security

# Step 3 — Evaluate

@if $security.critical_count > 0:
$passed = false
@else:
$passed = $lint.error_count == 0

@output: $passed
```

---

## Monorepo Structure

```
chainskills/
├── cli-mcp-core/        # TypeScript CLI + runtime engine (Node.js ≥ 20)
└── vscode-extension/    # VS Code extension for .workflow.md IDE support
```

| Package                                 | Description                                              | Tech                               |
| --------------------------------------- | -------------------------------------------------------- | ---------------------------------- |
| [`cli-mcp-core`](cli-mcp-core/)         | CLI, DAG engine, MCP server/client, `@agent` integration | TypeScript, Citty, Mastra, MCP SDK |
| [`vscode-extension`](vscode-extension/) | Syntax highlighting, Workflow Explorer, 10 commands      | VS Code API, Webpack               |

---

## Quick Start

```bash
git clone https://github.com/TheWatcher01/chainskills.git
cd chainskills/cli-mcp-core
pnpm install && pnpm build

# Run a workflow
pnpm exec tsx src/cli/index.ts run templates/dev/code-review.workflow.md

# Validate syntax
pnpm exec tsx src/cli/index.ts validate my-workflow.workflow.md

# Visualize the DAG
pnpm exec tsx src/cli/index.ts inspect my-workflow.workflow.md

# Scaffold a new workflow
pnpm exec tsx src/cli/index.ts init my-workflow

# Expose as MCP server (Copilot-compatible)
pnpm exec tsx src/cli/index.ts serve --port 3001
```

---

## Directives

17 `@` directives let you express any workflow logic in plain Markdown:

| Directive                    | Purpose                                     |
| ---------------------------- | ------------------------------------------- |
| `@use`                       | Import a skill, tool, or sub-workflow       |
| `@call expr → $var`          | Call a tool and capture the result          |
| `@if` / `@else`              | Conditional branching                       |
| `@for $item in $list:`       | Bounded iteration                           |
| `@repeat max:N until $cond:` | Loop with stop condition                    |
| `@parallel:`                 | Execute sibling steps in parallel           |
| `@try:` / `@on-error:`       | Error handling                              |
| `@assert $expr`              | Inline validation checkpoint                |
| `@output: $a, $b`            | Declare workflow outputs                    |
| `@env VAR_NAME`              | Reference an environment variable           |
| `@workflow name:`            | Inline sub-workflow                         |
| `@agent copilot: "task"`     | Delegate to an AI agent (OpenAI-compatible) |
| `@handoff review-agent:`     | Transfer control to another agent           |
| `@breakpoint $condition`     | Conditional debugging breakpoint            |

---

## Features

### Engine

- **DAG Orchestration** — Auto-parallelization by variable dependency analysis via [Mastra](https://mastra.ai)
- **Dual Executor** — `SimpleExecutor` (sequential) or `MastraExecutor` (DAG) — swap via `CHAINSKILLS_EXECUTOR`
- **Execution Control** — `pause()`, `resume()`, `cancel()`, `step()` with typed event system (11 events)
- **Hexagonal Architecture** — Pure domain core, 8 abstract ports, zero external dependencies in `core/`
- **Result<T,E> Monad** — `map`, `flatMap`, `mapErr`, `unwrapOr`, `match` utilities

### AI & Interoperability

- **MCP Server** — `chainskills serve` exposes 5 tools + 2 prompts + dynamic resources (stdio + HTTP)
- **MCP Client** — `@call mcp.tool_name()` invokes tools on any external MCP server
- **`@agent` / `@handoff`** — Delegate tasks to any OpenAI-compatible LLM (OpenAI, Claude, Ollama, Groq)
- **Copilot-ready** — `.vscode/mcp.json` auto-discovery for GitHub Copilot

### VS Code Extension

- **Syntax Highlighting** — TextMate grammar covering all 17 directives, `$variables`, `:::blocks`
- **Workflow Explorer** — TreeView with frontmatter metadata
- **10 Commands** — Run, Validate, Inspect, Pause, Resume, Stop, Step, Dry Run, Templates, Refresh
- **Auto-validate on Save** — Configurable background validation

### Templates

Pre-built workflows in [`cli-mcp-core/templates/`](cli-mcp-core/templates/):

| Category    | Workflows                                        |
| ----------- | ------------------------------------------------ |
| `dev/`      | `code-review`, `tdd-cycle`, `nextjs-app-builder` |
| `cybersec/` | `recon-target`, `vuln-scan`                      |
| `osint/`    | `domain-recon`                                   |
| `ess/`      | `grant-application`                              |

---

## Architecture

```
VS Code Extension
       │ import as library
  CLI (Citty)
       │
  Core (pure domain — zero dependencies)
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ Entities │ │Use Cases │ │ Services │ │  Ports   │
  └──────────┘ └──────────┘ └──────────┘ └──────────┘
       │ Ports & Adapters
  Adapters: Parser(Remark) · Executor(Mastra) · Tools(MCP) · Skills · State
```

---

## Development

```bash
# CLI + engine
cd cli-mcp-core
pnpm install
pnpm test          # 197 tests, Vitest
pnpm dev           # watch mode
pnpm build         # obuild (Rolldown)
pnpm lint          # prettier --check

# VS Code extension
cd vscode-extension
npm install
npm run compile
# Press F5 in VS Code → Extension Development Host
```

### Environment

```bash
cp cli-mcp-core/.env.example cli-mcp-core/.env
# PRODUCTION: replace secrets with Infisical / Doppler / Vault
```

Key variables: `CHAINSKILLS_EXECUTOR`, `OPENAI_API_KEY`, `MCP_SERVER_PORT`, `CHAINSKILLS_LOG_LEVEL`.  
See [`.env.example`](cli-mcp-core/.env.example) for the full list.

---

## Roadmap

| Phase | Version | Highlights                                            | Status |
| ----- | ------- | ----------------------------------------------------- | ------ |
| 1     | v0.1.0  | MVP — Parse + sequential run + CLI                    | ✅     |
| 2     | v0.2.0  | DAG (Mastra), full control flow, event system         | ✅     |
| 3     | v0.3.0  | MCP server/client, `@agent` LLM                       | ✅     |
| 4     | v0.4.0  | VS Code extension, ExecutionController, `@breakpoint` | ✅     |
| 5     | v0.5.0  | CodeLens, Diagnostics, Autocomplete, Hover            | 🔄     |
| 6     | v0.6.0  | Copilot Chat `@chainskills`, Agent Mode, DAG Webview  | ⏳     |
| 7     | v0.7.0  | Debug Adapter (DAP), Test Controller                  | ⏳     |
| 8     | v0.8.0  | Registry & distribution (npm-like)                    | ⏳     |
| 9     | v1.0.0  | Production & scale (SQLite, Redis)                    | ⏳     |

---

## Stack

| Layer             | Package                                                         |
| ----------------- | --------------------------------------------------------------- |
| CLI               | `citty`                                                         |
| Parser            | `unified` + `remark-parse` + `remark-directive` + `gray-matter` |
| DAG orchestration | `@mastra/core`                                                  |
| MCP interop       | `@modelcontextprotocol/sdk`                                     |
| Validation        | `zod`                                                           |
| Build             | `obuild` (Rolldown)                                             |
| Tests             | `vitest`                                                        |
| Package manager   | `pnpm`                                                          |

---

## License

[MIT](cli-mcp-core/LICENSE) © [TheWatcher01](https://github.com/TheWatcher01)
