# Features — chainskills v2.0.0

Cross-domain AI agent evaluation framework. Capture real workflows, replay with cheaper models, measure the difference.

## Core Architecture

**Hexagonal (Ports & Adapters)**
- Core domain: zero external dependencies, immutable entities, `Result<T,E>` error handling
- Adapters: parser, executor, tools, agents, validation, observability, registry, export
- DI container with subpath imports (`#core/*`, `#adapters/*`, `#cli/*`)

## The Flywheel

```
execute → trace → replay → bench → arena → distill → generate → leaderboard → export-hf → improve
```

Each stage feeds the next. The more you use chainskills, the smarter the routing becomes.

## Workflow Engine

- **19 directives**: `@use @call @if @else @for @repeat @parallel @try @on-error @assert @output @env @workflow @agent @handoff @breakpoint @schema @gate`
- **DAG orchestration**: Automatic dependency analysis, parallel execution, control flow
- **MCP integration**: Server (7 tools, 2 prompts, stdio/HTTP) + Client (call external MCP tools)
- **Agent providers**: Anthropic, OpenAI, Ollama, noop — auto-detected from env vars

## Host Agent Bridge

Capture tool calls from Claude Code and GitHub Copilot CLI without any API key.

- **`import-session`**: Parse JSONL transcripts → `ExecutionTrace[]`
- **`compare`**: Jaccard similarity on tools, files, success, steps (weighted 40/30/20/10)
- **Hook recorder**: PreToolUse/PostToolUse captures tool_response, agent_id, session_id
- **Cost reader**: Reads real costs from `~/.claude/projects/{path}/config.json`

## Intelligent Model Router

Route tasks to the cheapest model that can handle them — 2D routing across model AND effort level.

- **`scorecard`**: Model x task-type comparison grid with pass rates and savings
- **`route`**: Recommends model+effort based on historical performance
- **Cascade**: `haiku/low → haiku/high → sonnet/medium → opus/high`
- **Effort multipliers**: low=0.4x, medium=0.7x, high=1.0x, max=1.3x cost
- **15 task categories**: auto-classified from description keywords

## Autonomous Exploration (Reflexion)

Inspired by Reflexion (NeurIPS 2023) + LATS (ICML 2024).

- **`explore`**: Cascades through model+effort combinations
- **Anti-loop memory**: Injects failed attempt context ("DO NOT retry: Haiku/low scored 0/100")
- **Cycle detection**: Jaccard word overlap > 0.6 flags repeated approaches
- **Exploration tree**: Tracks hypotheses, best score, unexplored areas
- **Graduated scoring**: Expert tasks score 0-100 with multi-check validation

## Replay Tasks

16 reproducible tasks across 4 difficulty levels for model comparison.

| Level | Count | Discrimination |
|-------|-------|---------------|
| Easy | 3 | Low — most models pass |
| Medium | 3 | Moderate — requires understanding |
| Hard | 2 | High — multi-file, architecture |
| Expert | 8 | Maximum — vague instructions, hidden constraints |

**Expert tasks** (designed to fail small models):
- Vague bug report in 10-file codebase (race condition)
- Lazy refactor with no file list
- Performance optimization with hidden constraints
- Needle-in-haystack pagination bug in 9 files
- Add feature without breaking 12 existing tests
- Fix circular dependency across 8 files
- Find 5 subtle bugs in code review
- Full Express→Fastify migration

**Real results**: Opus 96% vs Haiku 4% on expert tasks. Both 100% on easy/medium.

## Benchmark Suite

- **100 workflows** across 6 domains (coding, data, security, writing, reasoning, tool-use)
- **3 difficulty levels** with golden file validation
- **Leaderboard**: Interactive HTML with Pareto ranking, shields.io badges
- **HuggingFace export**: JSONL + dataset card for public sharing

## Deep Compare

Code quality comparison beyond simple pass/fail.

- Nesting depth, function count, LoC, branch count, duplicate lines
- Composite quality score (0-100)
- ESLint error/warning counts
- Verdict: A better / B better / equivalent / inconclusive

## CLI Commands (22)

| Command | Purpose |
|---------|---------|
| `run` | Execute workflows |
| `validate` | Validate workflow syntax |
| `init` | Initialize new project |
| `inspect` | Inspect workflow DAG |
| `list` | List available workflows |
| `serve` | Start MCP server |
| `replay` | Replay with model switching |
| `bench` | Run single benchmark |
| `bench-suite` | Run benchmark suite |
| `distill` | Extract fine-tuning data |
| `publish` | Publish to registry |
| `add` | Add workflow to project |
| `arena` | Agent evaluation arena |
| `generate` | Generate workflow variants |
| `leaderboard` | Generate leaderboard |
| `export-hf` | Export to HuggingFace |
| `import-session` | Import Claude Code sessions |
| `compare` | Compare session traces |
| `scorecard` | Model comparison grid |
| `route` | Intelligent model routing |
| `deep-compare` | Code quality comparison |
| `explore` | Autonomous exploration |

## Workspace Isolation

Every replay task accepts `WORKSPACE=$1` for parallel execution. No cross-contamination between concurrent agents.

```bash
# Run 4 expert tasks in parallel, each in its own workspace
for task in replay-tasks/expert/*/; do
    WS="/tmp/chainskills-runs/$(basename $task)-$(uuidgen)"
    bash "$task/setup.sh" "$WS"
    # agent works in $WS
    bash "$task/verify.sh" "$WS"
done
```
