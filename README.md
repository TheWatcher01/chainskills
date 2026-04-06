# chainskills

> **The Chatbot Arena for AI agents** — benchmark, compare, and rank LLMs on real multi-step workflows.

[![CI](https://github.com/TheWatcher01/chainskills/actions/workflows/ci.yml/badge.svg)](https://github.com/TheWatcher01/chainskills/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](cli-mcp-core/LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)](cli-mcp-core/package.json)
[![Tests](https://img.shields.io/badge/tests-388%20passing-brightgreen.svg)](cli-mcp-core/tests)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple.svg)](https://modelcontextprotocol.io)

---

## Install

```bash
npm install -g chainskills
```

## Quick Start (5 commands)

```bash
# 1. Create a workflow
chainskills init my-review

# 2. Run it
chainskills run my-review.workflow.md

# 3. Benchmark across models
chainskills bench-suite --models claude-sonnet,gpt-4o-mini,qwen3:8b --suite benchmarks/

# 4. Compare models head-to-head
chainskills arena my-review.workflow.md --models claude-sonnet,gpt-4o-mini

# 5. Generate a public leaderboard
chainskills leaderboard --input bench-results/ --output site/
```

---

## Why chainskills?

**No tool evaluates AI agents on real multi-step workflows across domains.** SWE-bench tests code only. Chatbot Arena tests chat only. chainskills is the first cross-domain agent evaluation framework.

| | chainskills | SWE-bench | Chatbot Arena | AgentBench |
|---|---|---|---|---|
| Multi-step workflows | **Yes** | No | No | Partial |
| Cross-domain (6 domains) | **Yes** | Code only | Chat only | 8 envs |
| Cost-aware leaderboard | **Yes** | No | No | No |
| Trace → Replay → Distill | **Yes** | No | No | No |
| MCP/Copilot integration | **Yes** | No | No | No |
| Open source | **MIT** | MIT | Apache 2.0 | MIT |

---

## Features

### Agent Arena (Benchmark + Evaluate)
- **100 benchmark workflows** across 6 domains (coding, data, security, writing, reasoning, tool-use)
- **3 difficulty levels** (easy, medium, hard) with golden file validation
- **Elo rating** with blind A/B arena comparison
- **Cost-aware leaderboard** — Pareto frontier (quality vs cost)
- **HuggingFace export** — `chainskills export-hf` for dataset publication

### Flywheel (Trace + Improve)
- **Trace recording** — every workflow execution produces structured traces (JSONL/CRAG)
- **Replay** — re-run traces with different models (`chainskills replay`)
- **Distillation** — extract fine-tuning JSONL from high-quality traces
- **Few-shot feedback** — trace-informed agent auto-injects best examples
- **Variant generation** — LLM generates workflow variants from templates

### Multi-Provider
- **Anthropic** — native Messages API (Claude Opus, Sonnet, Haiku)
- **OpenAI** — Chat Completions API (GPT-4o, o3-mini)
- **Ollama** — local models (Qwen, Llama, Mistral, DeepSeek)
- Auto-detection from API keys, per-invocation model override

### Engine
- **19 directives** — `@agent`, `@parallel`, `@schema`, `@gate`, `@try`, `@if`, `@for`...
- **DAG orchestration** — auto-parallelization by variable dependency
- **MCP server** — 7 tools + 2 prompts, stdio/HTTP transport
- **Hexagonal architecture** — pure domain core, zero external deps

### VS Code Extension
- Syntax highlighting for 19 directives
- Workflow Explorer, CodeLens, Diagnostics
- 15+ commands (run, bench, arena, distill, generate...)
- Copilot Chat participant `@chainskills`

---

## CLI Commands (17)

| Command | Description |
|---------|-------------|
| `run` | Execute a workflow |
| `validate` | Check workflow syntax |
| `inspect` | Visualize DAG structure |
| `init` | Scaffold a new workflow |
| `list` | List available workflows |
| `serve` | Start MCP server |
| `replay` | Re-run traces with different model |
| `bench` | Benchmark one workflow across models |
| `bench-suite` | Run full benchmark suite |
| `arena` | Blind A/B model comparison with Elo |
| `distill` | Extract fine-tuning JSONL from traces |
| `generate` | Generate workflow variants via LLM |
| `publish` | Publish workflow to registry |
| `add` | Install workflow from registry |
| `leaderboard` | Generate static leaderboard site |
| `export-hf` | Export results as HuggingFace dataset |

---

## Benchmark Suite

100 standardized workflows across 6 domains:

```
benchmarks/
  coding/      (17 workflows)  — fizzbuzz to LRU cache to event emitter
  data/        (16 workflows)  — CSV parse to streaming aggregation
  security/    (16 workflows)  — input validation to OAuth2 PKCE
  writing/     (17 workflows)  — commit messages to technical RFCs
  reasoning/   (17 workflows)  — bug finding to system design
  tool-use/    (17 workflows)  — file search to multi-step pipelines
```

```bash
# Run the full suite
chainskills bench-suite --models claude-sonnet-4-6,gpt-4o-mini --suite benchmarks/

# Filter by domain
chainskills bench-suite --models claude-sonnet-4-6 --domain security

# Dry-run (discover workflows without LLM calls)
chainskills bench-suite --models noop --dry-run
```

---

## Architecture

```
CLI (17 commands, Citty)
  │
Config (DI container, provider registry)
  │
Adapters (parser, executor, agents, trace-store, site-gen, HF-export)
  │
Core (entities, ports, services, use-cases) ← ZERO external deps
```

**Hexagonal**: dependencies point inward only. Core never imports adapters.

---

## Monorepo

| Package | Path | Purpose |
|---------|------|---------|
| **cli-mcp-core** | `cli-mcp-core/` | CLI + core library + MCP server |
| **vscode-extension** | `vscode-extension/` | VS Code extension |

---

## Development

```bash
git clone https://github.com/TheWatcher01/chainskills.git
cd chainskills && pnpm install

# CLI
cd cli-mcp-core
pnpm test          # 388 tests (Vitest)
pnpm typecheck     # tsc --noEmit
pnpm build         # obuild → 1.35 MB

# VS Code extension
cd vscode-extension
pnpm compile       # webpack → 23KB
```

### Environment

```bash
# Provider selection (auto-detects from API keys if unset)
export AGENT_PROVIDER=anthropic    # anthropic | openai | ollama | noop
export ANTHROPIC_API_KEY=sk-...
export AGENT_MODEL=claude-sonnet-4-6
```

---

## GitHub Action

```yaml
- uses: chainskills/bench-action@v1
  with:
    models: claude-sonnet-4-6,gpt-4o-mini
    provider: anthropic
    api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    suite: benchmarks/
```

---

## Roadmap

| Version | Highlights | Status |
|---------|-----------|--------|
| v0.1–v0.5 | MVP, DAG, MCP, VS Code extension, IDE features | Done |
| v0.6–v0.8 | Copilot AI, traces, replay, registry | Done |
| v0.9 | Flywheel: bench, arena, distill, generate, @schema, @gate | Done |
| **v1.0** | **Agent Arena: 100 benchmarks, Anthropic provider, leaderboard, HF export, GitHub Action** | **Current** |
| v1.1 | Live leaderboard, community benchmarks, SQLite traces | Planned |
| v1.2 | HuggingFace Spaces integration, streaming bench | Planned |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). TL;DR:

```bash
git clone && cd chainskills && pnpm install && pnpm test
```

---

## License

[MIT](cli-mcp-core/LICENSE) — [TheWatcher01](https://github.com/TheWatcher01)
