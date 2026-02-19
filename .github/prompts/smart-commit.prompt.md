````prompt
```prompt
---
name: smart-commit
description: Grouped semantic commits by feature for the chainskills monorepo — pre-commit cleanup audit
agent: agent
---

# Smart Commit — chainskills Monorepo

Analyze uncommitted changes across both packages and create well-structured grouped commits.

## Step 1 — Pre-commit Audit

**Before committing, clean up agent artifacts:**

```bash
# Find temporary/debug files
find . -name "*.tmp" -o -name "*.bak" -o -name "*_old.*" -o -name "*_debug.*" 2>/dev/null
git status --porcelain | grep "^??"
```

Check for:
- [ ] No secrets or credentials in the diff
- [ ] No `console.log` / debug code left in
- [ ] No commented-out code blocks
- [ ] TypeScript types complete (no `any` added)
- [ ] No trace of agent reasoning process in committed code

## Step 2 — Inspect Changes

```bash
git status --porcelain
git diff --stat
```

## Step 3 — Group by Package + Feature

Group changes into independent logical commit units. Each commit must be deployable alone.

### Package Scopes

**CLI/Core (`cli-mcp-core/`):**
- `core` — entities, use-cases, services, ports
- `parser` — remark adapter, frontmatter, AST
- `executor` — mastra, simple-executor
- `mcp` — MCP client/server adapters
- `cli` — CLI commands (run, validate, init, etc.)
- `config` — DI container, env validation
- `templates` — workflow templates

**VS Code Extension (`vscode-extension/`):**
- `extension` — activation, commands, tree provider
- `providers` — CodeLens, Completion, Diagnostics, Hover, etc.
- `views` — StatusBar, Webview
- `copilot` — Chat Participant, Agent Mode Tools

**Cross-package:**
- `agents` — `.github/agents/*.agent.md`
- `skills` — `.github/skills/` or `~/.agents/skills/`
- `docs` — AGENTS.md, ROADMAP.md, README.md
- `ci` — GitHub Actions, config files

## Step 4 — Write Conventional Commits

Format: `type(scope): short description`

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`, `ci`

```bash
# Example groupings
git add cli-mcp-core/src/core/ cli-mcp-core/src/adapters/
git commit -m "feat(core): add ExecutionController with pause/resume/cancel"

git add vscode-extension/src/providers/
git commit -m "feat(providers): add CodeLens and Completion providers"

git add .github/ AGENTS.md
git commit -m "chore(agents): add Orchestrator and Extension agents to root .github"
```

## Step 5 — Execute Sequentially

Create commits in dependency order (foundation before features).
Ask for confirmation before each group if changes are significant.

```

````
