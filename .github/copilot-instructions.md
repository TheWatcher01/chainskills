````instructions
```instructions
# Copilot Instructions — chainskills (Monorepo)

## Workspace Structure

This is a **monorepo** with two packages:

| Package | Path | Purpose |
|---------|------|---------|
| **cli-mcp-core** | `cli-mcp-core/` | TypeScript CLI + core library — workflow parsing, execution, MCP |
| **vscode-extension** | `vscode-extension/` | VS Code extension — language features, Copilot Chat integration |

## Shared Architecture Principles

**Hexagonal (Ports & Adapters)** — applies to both packages:
- Core domain: zero external dependencies
- Dependencies point inward: adapters → core, never reverse
- Every integration uses a port (interface) + adapter (implementation)
- Result/Either pattern for error handling — never `throw` for business logic

## Package Managers & Build

```bash
# CLI/Core package
cd cli-mcp-core && pnpm build && pnpm test

# VS Code Extension
cd vscode-extension && npm run compile
```

## Cross-Package Conventions

- **Language**: TypeScript strict everywhere
- **Imports**: ESM only (`import`/`export`), no CommonJS
- **Naming**: kebab-case files, PascalCase classes, camelCase functions
- **Types**: Strong typing, generics, `unknown` over `any`
- **Errors**: Result<T,E> domain errors + typed exceptions for infra panics
- **Config**: All params via environment variables, no hardcoded values
- **Secrets**: Never in code or git. `.env` = dev only → `.gitignore`

## Agentic Infrastructure

- **Agents**: `.github/agents/` — shared across both packages (Research, Plan, Review, Orchestrator, Extension)
- **Skills**: `.github/skills/` — workspace-level; `~/.agents/skills/` — global
- **Instructions**: `.github/instructions/` — all path-specific instructions (6 files with `applyTo` globs)
- **Prompts**: `.github/prompts/` — all prompts (smart-commit, smart-review, chainskills-plan)
- **AGENTS.md**: Root = monorepo index. Project = project detail (nearest-wins).

## Detailed Context

- **CLI/Core**: [cli-mcp-core/AGENTS.md](../cli-mcp-core/AGENTS.md)
- **Extension**: [vscode-extension/AGENTS.md](../vscode-extension/AGENTS.md)
- **Roadmap**: [ROADMAP.md](../ROADMAP.md)

```

````
