# AGENTS.md — chainskills (Monorepo)

> Universal entry point for all AI agents. Indexes the complete agentic architecture.
> Each package has its own AGENTS.md with project-specific context (nearest-file-wins).

## Workspace

**chainskills** is a monorepo with two packages:

| Package              | Path                | Purpose                                                          |
| -------------------- | ------------------- | ---------------------------------------------------------------- |
| **cli-mcp-core**     | `cli-mcp-core/`     | TypeScript CLI + core library — workflow parsing, execution, MCP |
| **vscode-extension** | `vscode-extension/` | VS Code extension — language features, Copilot Chat integration  |

### Build Commands

```bash
cd cli-mcp-core && pnpm build && pnpm test   # CLI/Core
cd vscode-extension && pnpm compile        # Extension
```

---

## Shared Agents (`.github/agents/`)

| Agent             | Role                                                    | Scope               |
| ----------------- | ------------------------------------------------------- | ------------------- |
| **Research**      | Deep research — web, npm, GitHub, VS Code API, MCP spec | Both packages       |
| **Architect**     | Architecture-aware planning, read-only exploration      | Both packages       |
| **Review**        | Quality assurance, architecture compliance              | Both packages       |
| **Orchestrator**  | Supervisor — routes to specialized agents               | Both packages       |
| **Extension**     | VS Code API specialist — providers, Chat, Agent Mode    | `vscode-extension/` |
| **CopilotExpert** | Copilot Chat expert — agents, toolsets, hooks, config   | Both packages       |

---

## Skills Ecosystem

### Global Skills (`~/.agents/skills/`)

| Skill                 | Purpose                                                              |
| --------------------- | -------------------------------------------------------------------- |
| **agentic-workspace** | SOTA agentic workspace setup — agents, skills, instructions layering |

### Workspace Skills (`.github/skills/`)

| Skill             | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| **monorepo-sync** | Keep roadmaps, AGENTS.md, versions in sync across packages |
| **smart**         | Auto-learning from development errors                      |
| **smart-commit**  | Grouped commits with architecture-aware scopes             |
| **research**      | Multi-source research protocol with freshness validation   |

---

## Instructions (`.github/instructions/`)

| File                        | `applyTo`                           | Purpose                                     |
| --------------------------- | ----------------------------------- | ------------------------------------------- |
| `core.instructions.md`      | `cli-mcp-core/src/core/**`          | Zero deps, Result pattern, immutability     |
| `cli.instructions.md`       | `cli-mcp-core/src/cli/**`           | Citty conventions, one-file-per-command, DI |
| `adapters.instructions.md`  | `cli-mcp-core/src/adapters/**`      | Ports & adapters, DI, no domain logic       |
| `tests.instructions.md`     | `**/tests/**`                       | Vitest conventions, unit vs integration     |
| `extension.instructions.md` | `vscode-extension/**`               | VS Code API, Disposable, webpack            |
| `providers.instructions.md` | `vscode-extension/src/providers/**` | Provider interfaces, WorkflowDocument cache |

---

## Prompts (`.github/prompts/`)

| Prompt               | Agent  | Purpose                                              |
| -------------------- | ------ | ---------------------------------------------------- |
| **smart-commit**     | agent  | Monorepo-aware grouped commits with pre-commit audit |
| **smart-review**     | Review | Cross-package architecture compliance review         |
| **chainskills-plan** | agent  | Complete project blueprint (491 lines)               |

---

## Cross-Package Architecture

Both packages follow **Hexagonal (Ports & Adapters)**:

- Core domain: zero external dependencies
- Dependencies point inward: adapters → core, never reverse
- Every integration uses a port (interface) + adapter (implementation)
- Result/Either pattern for error handling — never `throw` for business logic

### Conventions

- **Language**: TypeScript strict everywhere
- **Imports**: ESM only (`import`/`export`), no CommonJS
- **Naming**: kebab-case files, PascalCase classes, camelCase functions
- **Types**: Strong typing, generics, `unknown` over `any`
- **Config**: All params via environment variables, no hardcoded values
- **Secrets**: Never in code or git. `.env` = dev only → `.gitignore`

---

## Project-Specific Context

- **CLI/Core**: [cli-mcp-core/AGENTS.md](cli-mcp-core/AGENTS.md)
- **Extension**: [vscode-extension/AGENTS.md](vscode-extension/AGENTS.md)

---

## Roadmap

| Phase | Version       | Status                                        |
| ----- | ------------- | --------------------------------------------- |
| 1–5   | v0.1.0–v0.5.0 | ✅ All completed                              |
| 6     | v0.6.0        | 🔄 En cours — Copilot Chat + Agent Mode       |
| 7     | v0.7.0        | ⏳ Planifié — Debug Adapter + Test Controller |
| 8+    | v0.8.0+       | ⏳ Planifié — Registry + Community            |

**Roadmap**: [ROADMAP.md](ROADMAP.md)
