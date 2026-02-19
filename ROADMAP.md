# ROADMAP — chainskills (Portfolio)

> Last reviewed: 2026-02-19
> Scope: Monorepo portfolio roadmap (root view). Detailed implementation tracking remains in child roadmaps.

## Canonical Sources

- Portfolio (this file): `ROADMAP.md`
- CLI/Core canonical roadmap: `cli-mcp-core/.github/ROADMAP.md`
- VS Code extension milestones: tracked in `cli-mcp-core/.github/ROADMAP.md` (v0.4+), with extension context in `vscode-extension/README.md`

## Governance Contract

- One canonical roadmap per scope.
- Root roadmap is summary only (status, dependencies, release train).
- Child roadmap owns detailed implementation logs/checklists.
- Any milestone status change must update:
  1. this portfolio file,
  2. impacted child canonical roadmap,
  3. high-level tables in `README.md` and `AGENTS.md`.

## Unified Release Train

| Phase | Version | Portfolio Milestone                                              | Status         | Canonical Detail                  |
| ----- | ------- | ---------------------------------------------------------------- | -------------- | --------------------------------- |
| 1     | v0.1.0  | MVP — parse, run, CLI, tests                                     | ✅ Completed   | `cli-mcp-core/.github/ROADMAP.md` |
| 2     | v0.2.0  | DAG orchestration (Mastra), full control flow                    | ✅ Completed   | `cli-mcp-core/.github/ROADMAP.md` |
| 2.1   | v0.2.1  | Security hardening, Result monad utilities                       | ✅ Completed   | `cli-mcp-core/.github/ROADMAP.md` |
| 3     | v0.3.0  | MCP server/client, `@agent` support, SDK API                     | ✅ Completed   | `cli-mcp-core/.github/ROADMAP.md` |
| 4     | v0.4.0  | VS Code extension skeleton, `@breakpoint`, execution controller  | ✅ Completed   | `cli-mcp-core/.github/ROADMAP.md` |
| 5     | v0.5.0  | IDE language features (CodeLens, diagnostics, completion, hover) | ✅ Completed   | `cli-mcp-core/.github/ROADMAP.md` |
| 6     | v0.6.0  | Copilot Chat `@chainskills`, Agent Mode tools, DAG webview       | 🔄 In progress | `cli-mcp-core/.github/ROADMAP.md` |
| 7     | v0.7.0  | Debug Adapter (DAP), Test Controller, rename/references          | ⏳ Planned     | `cli-mcp-core/.github/ROADMAP.md` |
| 8     | v0.8.0  | Registry & remote/git workflow distribution                      | ⏳ Planned     | `cli-mcp-core/.github/ROADMAP.md` |
| 9     | v0.9.0  | Polish: integration tests, marketplace publish, performance      | ⏳ Planned     | `cli-mcp-core/.github/ROADMAP.md` |
| 10    | v1.0.0  | Production scale: SQLite/Redis, enterprise readiness             | ⏳ Planned     | `cli-mcp-core/.github/ROADMAP.md` |

## Cross-Package Dependencies

- `v0.6.0` depends on extension chat participant implementation + MCP wiring stability.
- `v0.7.0` depends on stable execution controller semantics and workflow debug metadata.
- `v0.8.0+` depends on package provenance, registry contracts, and skill resolution compatibility.

## Update Checklist

- [ ] Milestone status updated in this file
- [ ] Detailed changes reflected in child canonical roadmap
- [ ] `README.md` and `AGENTS.md` summary tables synchronized
- [ ] Related links and paths validated from workspace root
