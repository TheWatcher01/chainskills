```prompt
---
name: commit
description: Smart grouped commits by feature for chainskills
agent: agent
---

# Smart Commit — chainskills

Analyze uncommitted changes and create logical grouped commits.

## Workflow

1. Check git status for all changes
2. Group files by logical feature/area
3. Create separate commits for each group
4. Use descriptive commit messages

## Analysis

```bash
git status --porcelain
```

## Commit Strategy

Group changes by:

- **feat**: New features (entities, use cases, adapters, CLI commands)
- **fix**: Bug fixes
- **docs**: Documentation only (README, AGENTS.md, prompts)
- **style**: Formatting, no code change
- **refactor**: Code restructuring
- **test**: Test additions/changes
- **chore**: Maintenance tasks
- **config**: Configuration changes (.github/, tsconfig, build config)

## Message Format

```
type(scope): short description

- Detail 1
- Detail 2
```

### Scopes for chainskills

- `core` — entities, use-cases, services, ports
- `parser` — remark adapter, frontmatter, AST
- `executor` — mastra, simple-executor
- `mcp` — MCP client/server adapters
- `cli` — CLI commands (run, validate, init, etc.)
- `config` — DI container, env validation
- `templates` — workflow templates
- `registry` — npm/git registry adapters

## Pre-Commit Cleanup

**BEFORE committing, clean up agent artifacts:**

1. Delete failed/temp scripts
2. Delete temporary files (`*.tmp`, `*.bak`, `*.log`)
3. Delete reflection artifacts
4. Clean incomplete work

```bash
find . -name "*.tmp" -o -name "*.bak" -o -name "*_old.*" -o -name "*_debug.*" 2>/dev/null
git status --porcelain | grep "^??"
```

**Rule: No trace of agent's reasoning process should remain in committed code.**

## Example Groups

```bash
# Group 1: Core domain entities
git add src/core/entities/ src/core/ports/
git commit -m "feat(core): add Workflow, Step, Directive entities and ports"

# Group 2: Parser adapter
git add src/adapters/parser/
git commit -m "feat(parser): implement remark-based .workflow.md parser"

# Group 3: CLI commands
git add src/cli/
git commit -m "feat(cli): add run, validate, and init commands"

# Group 4: Tests
git add tests/
git commit -m "test(parser): add frontmatter and directive parsing tests"

# Group 5: Config & docs
git add .github/ AGENTS.md README.md
git commit -m "docs: add agentic architecture and project documentation"
```

Execute commits sequentially, asking for confirmation before each.

```
