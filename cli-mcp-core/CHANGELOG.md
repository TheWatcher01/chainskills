# CHANGELOG — chainskills

## [0.3.0] - 2026-02-13

### Added

#### Phase A (v0.2.1 Security)

- **Security hardening** for shell tool provider:
  - Replaced `execSync` with `execFileSync` to prevent shell interpretation
  - Command allowlist with configurable whitelist (`CHAINSKILLS_SHELL_ALLOWLIST`)
  - Metacharacter rejection regex for dangerous shell patterns
  - Safe environment variable forwarding
- **Scoped `@env` directive**: Only env vars declared in workflow frontmatter `env: []` are accessible
- **Path traversal protection** in local skill resolver
- **Result monad utilities**: `map`, `flatMap`, `mapErr`, `unwrapOr`, `unwrapOrElse`, `match`
- **Architecture fix**: Moved `createEventEmitter()` from port to infrastructure layer

#### Phase B (v0.3.0-alpha MCP Server)

- **MCP Server adapter** with 5 tools:
  - `chainskills_run` — Execute workflows (destructive, non-idempotent)
  - `chainskills_validate` — Validate workflows (read-only, idempotent)
  - `chainskills_describe` — Introspect workflow structure (read-only, idempotent)
  - `chainskills_list` — List workflows in directory (read-only, idempotent)
  - `chainskills_inspect` — DAG structure (read-only, idempotent)
- **MCP Prompts**: `create_workflow`, `explain_workflow`
- **MCP Resources**: Dynamic auto-discovery of `.workflow.md` files
- **SDK API**: `runWorkflow()` and `describeWorkflow()` for programmatic usage
- **CLI `serve` command**: Expose chainskills as MCP server (stdio or HTTP transport)
- **`--json` mode**: Added to `run` and `validate` commands for machine-readable output
- **`.vscode/mcp.json`**: Copilot auto-discovery configuration
- **MCP config**: `MCP_TRANSPORT`, `MCP_SERVER_NAME`, `MCP_SERVER_VERSION` env vars

#### Phase C (@agent LLM Integration)

- **AgentProvider port**: Abstract interface for AI agent delegation
- **OpenAI-compatible agent adapter**: Universal LLM integration via native `fetch`
  - Supports OpenAI, Anthropic, Ollama, LM Studio, Groq, Together, etc.
  - Configurable via `AGENT_API_KEY`, `AGENT_BASE_URL`, `AGENT_MODEL`
  - Default agents: copilot, reviewer, writer (with system prompts)
  - Automatic workflow variable injection into system prompt
- **NoopAgent**: Stub agent for tests and dry-run mode (no API key needed)
- **`@agent` directive**: Delegate tasks to AI agents with LLM API calls
- **`@handoff` directive**: Transfer execution to another agent
- **Agent result capture**: `@agent copilot: "task" → $variable`

#### Phase D (MCP Client)

- **MCP Client tool provider**: Call tools on external MCP servers via `@call mcp.tool_name()`
  - Lazy connection on first use
  - Auto-discovery of tools via `listTools()`
  - Stdio transport for subprocess MCP servers
  - Graceful shutdown with `close()` method
- **Composite tool provider**: Route `@call` by namespace (shell, mcp, etc.)
  - Extensible architecture for adding HTTP, SSE, custom tool providers
- **MCP_SERVERS env var**: JSON config for external MCP server connections

### Changed

- **Error handling**: Directive handlers return `{ error }` instead of throwing (Result pattern)
- **Container DI**: `createContainer()` is now async (dynamic imports for Mastra)
- **Agent wiring**: Agent provider automatically configured based on `AGENT_API_KEY` presence

### Fixed

- **Shell injection vulnerability**: Command allowlist + execFileSync + metacharacter rejection
- **Unscoped environment access**: `@env` now scoped to frontmatter-declared variables
- **Path traversal**: Local resolver validates paths stay within base directory
- **ESM compatibility**: Replaced `require()` with `await import()` in container
- **Async bugs**: Fixed incorrect `await` usage with synchronous `StateStore.set()`

### Dependencies

- **Pinned**: `@mastra/core` from `"latest"` to `^1.3.0`
- **Added**: Node.js subpath imports (`#core/*`, `#adapters/*`, etc.)

### Tests

- **Phase A**: 141 tests (11 files)
- **Phase B**: 149 tests (12 files) — 8 new MCP server tests
- **Phase C**: 164 tests (13 files) — 15 new agent provider tests
- **Phase D**: 179 tests (14 files) — 15 new MCP client + composite tests
- **Coverage**: Core domain, adapters, CLI, MCP, agents

### Build

- **Size**: 770 kB total (24 files), 5 bundles
- **Bundles**: index, cli, markdown-parser, simple-executor, mastra-executor
- **Exports**: 26 public API functions/types

### Documentation

- **ROADMAP.md**: Updated with v0.2.1, v0.3.0-alpha, v0.3.0 sections
- **AGENTS.md**: Architecture summary, v0.3.0 status, metrics
- **README.md**: Features marked as available (MCP, @agent)
- **.env.example**: All new env vars documented

---

## [0.2.0] - 2026-02-13

### Added

- **DAG orchestration** with Mastra 1.x (`.then()`, `.parallel()`, `.branch()`, `.foreach()`)
- **Full control flow**: `@if/@else`, `@for`, `@repeat`, `@try/@on-error`, `@parallel`, `@workflow`
- **Execution events**: 11 event types, streaming to CLI
- **CLI commands**: `inspect` (DAG visualization), `list` (workflow discovery)
- **Parser block support**: Container directives (`:::parallel`, `:::if`, etc.)
- **Auto-parallelization**: Dependency analysis for automatic parallel execution
- **Templates**: 6 workflows (dev, cybersec, osint, ess) with enriched directives

### Changed

- **Executor strategy**: Simple + Mastra coexistence via `CHAINSKILLS_EXECUTOR` env var
- **Build**: 5 bundles (636 kB total, 21 files)
- **Tests**: 141 passing (11 files)

---

## [0.1.0] - 2026-02-13

### Added

- **Hexagonal architecture**: Core domain, 6 ports, 7 adapters
- **Parser**: Markdown + frontmatter + remark-directive
- **Executor**: Sequential workflow execution with state propagation
- **CLI**: `run`, `validate`, `init` commands
- **Shell tools**: `@call shell.exec()` with real subprocess execution
- **Local skills**: `@use ./path` resolution
- **Templates**: 4 workflows (dev, cybersec, osint, ess)
- **Node.js subpath imports**: `#core/*`, `#adapters/*`, etc.

### Tests

- **86 tests** (7 files): parser, runtime, CLI

### Build

- **252 kB total** (4 bundles)

---

## Legend

- **Added**: New features, APIs, tools
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Vulnerability fixes
