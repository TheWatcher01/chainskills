# CHANGELOG — chainskills

## [2.0.0] - 2026-04-06

### Added — Phase L (Autonomous Agent Framework)

- **Workspace isolation**: All 16 replay tasks accept `WORKSPACE=$1` argument for parallel execution
  - No more cross-contamination between concurrent agents
  - Each agent gets its own `/tmp/chainskills-runs/{task}-{uuid}` directory
- **Effort-level routing**: 2D cascade `model x effort` (low/medium/high/max)
  - `EffortLevel` type in `model-router.ts`
  - `estimateCostWithEffort()` with multipliers: low=0.4x, medium=0.7x, high=1.0x, max=1.3x
  - `recommend()` traverses 2D cascade from cheapest to most expensive
- **Reflexion memory** (NeurIPS 2023 + LATS ICML 2024):
  - `Hypothesis` and `ExplorationTree` entities
  - `createTree()`, `addHypothesis()`, `generateAntiLoopContext()`
  - `detectCycle()` using Jaccard word overlap > 0.6
  - `suggestNext()` for unexplored file areas
  - `summarizeTree()` for exploration reports
- **`chainskills explore`** CLI command:
  - Autonomous task exploration with cascade and anti-loop injection
  - Configurable `--cascade`, `--max-attempts`, `--pass-threshold`
  - Saves `.exploration-tree.json` after each run
- **Claude Code cost reader**: `readClaudeCodeCosts()` reads `~/.claude/projects/{path}/config.json`
  - Extracts `lastCost`, `lastModelUsage`, `lastTotalInputTokens`, etc.
- **Hook recorder enriched**: `chainskills-recorder.sh` now captures:
  - `tool_response` from PostToolUse (truncated to 2000 chars)
  - `agent_id` to isolate sub-agent traces
  - Filters out internal tools (TaskCreate, ToolSearch, EnterPlanMode)

### Added — Phase K (Expert Tasks + Deep Compare)

- **4 new expert replay tasks** (03, 05, 06, 08) — total 8 expert tasks:
  - `03-perf-with-constraints`: Optimize endpoint with hidden constraints (no cache, no deps, SLA <200ms)
  - `05-feature-preserve-behavior`: Add CSV export without breaking 12 existing JSON tests
  - `06-cross-dependency`: Fix circular import crash across 8 files
  - `08-multi-step-migration`: Migrate Express to Fastify (6 files, middleware to hooks)
- **4 existing expert tasks** (01, 02, 04, 07):
  - `01-vague-bug-report`: Race condition in cache across 10 files
  - `02-lazy-refactor`: Deduplicate code across 3 modules (scored 0-100)
  - `04-needle-debug`: Off-by-one pagination bug in 9 files
  - `07-subtle-code-review`: Find 5 bugs (type coercion, off-by-one, div-by-zero, memory leak, async)
- **Graduated scoring**: Expert verify.sh scripts output `SCORE: N/100` with multi-check validation
- **`chainskills deep-compare`** CLI command:
  - Regex-based code metrics: nesting depth, function count, LoC, branch count, duplicate lines
  - `computeQualityScore()` composite (base 70, penalties)
  - Verdict: A better / B better / equivalent / inconclusive

### Added — Phase J (Model Router)

- **`chainskills scorecard`** CLI command:
  - Displays model x task-type comparison grid
  - Groups by (taskType, model, effort) — 3 dimensions
  - Shows pass rates, costs, savings vs Opus
- **`chainskills route`** CLI command:
  - Recommends model+effort for a given task description
  - `classifyTask()` uses keyword matching against 15 task categories
  - Confidence score based on pass rate + number of runs
- **Model pricing registry**: `model-pricing.ts`
  - Aligned with Claude Code tiers (COST_TIER_3_15, COST_TIER_15_75)
  - Covers Claude, GPT-4o, Gemini, Llama, Mistral, DeepSeek

### Added — Phase I (Host Agent Bridge)

- **`chainskills import-session`** CLI command:
  - Parses Claude Code JSONL transcripts into `ExecutionTrace[]`
  - Extracts `tool_use` from assistant messages, `tool_result` from user messages
  - `--show-tasks` mode displays task summary
- **`chainskills compare`** CLI command:
  - Compares 2 session traces with Jaccard similarity
  - Weighted: 40% tools + 30% files + 20% success + 10% steps
  - Verdict: A/B significantly better, similar, or insufficient data
- **Session parser adapter**: `session-parser.ts`
  - `parseClaudeCodeSession()` handles both tool_use and tool_result
  - `groupByTask()` groups by user prompts

### Added — Phase H (Leaderboard + HF Export)

- **`chainskills leaderboard`** CLI command:
  - Generates interactive HTML with sortable dark-theme table
  - Pareto rank computation
  - shields.io badge generation
- **`chainskills export-hf`** CLI command:
  - Converts bench results to HuggingFace JSONL
  - Generates dataset card README with YAML frontmatter

### Added — Phase G (Benchmark Suite)

- **`chainskills bench-suite`** CLI command:
  - Runs 100 benchmarks across 6 domains (coding, data, security, writing, reasoning, tool-use)
  - 3 difficulty levels (easy, medium, hard)
  - Golden file validation for deterministic pass/fail
- **`chainskills bench`**: Single benchmark runner

### Added — Phase F (Agent Arena)

- **`chainskills arena`**: Head-to-head model comparison with Elo ratings
- **`chainskills distill`**: Extract fine-tuning data from traces
- **`chainskills generate`**: Generate workflow variants from templates

### Added — Phase E (Replay + Observability)

- **`chainskills replay`**: Re-run workflows with model switching
- **Trace recording**: JSONL trace capture with tool calls, timing, tokens
- **12+ replay tasks**: Easy (3), Medium (3), Hard (2), Expert (8)

### Changed

- **Package version**: 1.0.0 → 2.0.0
- **CLI commands**: 17 → 22 (added scorecard, route, deep-compare, explore, import-session, compare)
- **Test count**: 179 → 388 tests across 43 files
- **Build size**: 770 kB → 1.4 MB (29 bundles from 24)
- **Exports**: 26 → 28 public API functions
- **Model router**: 1D (model only) → 2D (model x effort)
- **Verify scripts**: Binary pass/fail → graduated scoring (0-100) for expert tasks

### Fixed

- **Workspace cross-contamination**: Parallel agents no longer overwrite `/tmp/replay-test/`
- **Expert verify false positives**: Comments no longer trigger code checks
- **Brace expansion in scripts**: `"$WS/{a,b}"` replaced with `"$WS/a" "$WS/b"`
- **Session parser**: `tool_result` correctly extracted from user messages (Anthropic API convention)
- **Import session JSON parse**: Truncated tool inputs no longer crash parser

---

## [1.0.0] - 2026-04-05

### Added

- **CI/CD**: GitHub Actions workflows for test + typecheck + build (Node 20/22 matrix)
- **Monthly benchmark workflow**: Auto-runs suite, generates leaderboard, deploys to GH Pages
- **Reusable bench action**: `.github/actions/bench/action.yml`
- **Issue templates**: Bug report + feature request (YAML forms)
- **Anthropic native agent provider**: Direct Messages API via `fetch`
- **Agent provider auto-detection**: Reads `AGENT_PROVIDER` env var

### Changed

- **README.md**: Overhauled for v1.0 Agent Arena positioning
- **Documentation**: CONTRIBUTING.md, ROADMAP.md updated

---

## [0.9.0] - 2026-03-15

### Added

- **`@schema` directive**: Validate step outputs with Zod schemas
- **`@gate` directive**: Conditional workflow progression
- **Trace-informed agent**: Inject prior traces as few-shot examples
- **Execution controller**: Cancellation tokens, timeout handling
- **Data provenance**: Track data lineage through workflow steps

### Changed

- **Commands**: 12 → 14
- **Directives**: 17 → 19

---

## [0.4.0] - 2026-02-20

### Added

- **Flywheel pipeline**: execute → trace → replay → bench → arena → distill → generate → leaderboard
- **Elo rating system**: Pairwise model comparison with K-factor tuning
- **Workflow generation**: Template-based variant creation with mutation strategies
- **Full E2E tests**: Flywheel integration + MCP tools

### Changed

- **Tests**: 179 → 250+

---

## [0.3.0] - 2026-02-13

### Added

#### Phase A (Security)

- Shell injection protection: `execFileSync` + command allowlist + metacharacter rejection
- Scoped `@env` directive: Only frontmatter-declared env vars accessible
- Path traversal protection in local skill resolver
- `Result<T,E>` monad utilities: `map`, `flatMap`, `mapErr`, `unwrapOr`, `unwrapOrElse`, `match`

#### Phase B (MCP Server)

- MCP Server adapter with 5 tools (run, validate, describe, list, inspect)
- MCP Prompts: `create_workflow`, `explain_workflow`
- CLI `serve` command (stdio/HTTP transport)

#### Phase C (@agent LLM Integration)

- AgentProvider port + OpenAI-compatible adapter (OpenAI, Anthropic, Ollama, etc.)
- `@agent` and `@handoff` directives
- NoopAgent for tests/dry-run

#### Phase D (MCP Client)

- MCP Client tool provider via `@call mcp.tool_name()`
- Composite tool provider with namespace routing
- `MCP_SERVERS` env var configuration

### Fixed

- Shell injection, unscoped env access, path traversal, ESM compatibility, async bugs

---

## [0.2.0] - 2026-02-13

### Added

- DAG orchestration with Mastra 1.x
- Full control flow: `@if/@else`, `@for`, `@repeat`, `@try/@on-error`, `@parallel`, `@workflow`
- Execution events: 11 event types
- CLI: `inspect`, `list`
- Auto-parallelization via dependency analysis

---

## [0.1.0] - 2026-02-13

### Added

- Hexagonal architecture: Core domain + 6 ports + 7 adapters
- Markdown parser with frontmatter + remark-directive
- Sequential executor with state propagation
- CLI: `run`, `validate`, `init`
- Shell tools: `@call shell.exec()`
- 86 tests (7 files), 252 kB build
