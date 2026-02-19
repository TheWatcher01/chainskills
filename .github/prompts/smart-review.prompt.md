````prompt
```prompt
---
name: smart-review
description: Smart code review for the chainskills monorepo — architecture compliance, hexagonal rules, VS Code extension patterns, and code quality
agent: Review
---

# Smart Review — chainskills Monorepo

Review recent changes across both packages for architecture compliance, code quality, and correctness.

## Step 1 — Identify Changes

```bash
git diff --name-only HEAD~1
git diff --stat HEAD~1
```

## Step 2 — Route Review by Package

### If changes are in `cli-mcp-core/`:

**Hexagonal Architecture:**
- `src/core/` — zero external deps? Ports = interfaces only? Result pattern?
- `src/adapters/` — implements exactly one port? No domain logic? DI only?
- `src/cli/` — uses DI container? One file per command? No direct adapter instantiation?

**Build check:**
```bash
cd cli-mcp-core && pnpm build && pnpm test && pnpm lint
```

### If changes are in `vscode-extension/`:

**Extension Patterns:**
- All disposables in `context.subscriptions.push()`?
- `parseWorkflowDocument()` used for all providers?
- New APIs require engine version bump?
- Commands registered in both `commands.ts` AND `package.json`?

**Build check:**
```bash
cd vscode-extension && pnpm compile
```

### If changes are in `.github/` (agents, skills, instructions):

**Agentic Quality:**
- Agents: single purpose, correct tool scoping, handoffs defined?
- Instructions: `applyTo` is narrowest applicable glob?
- Skills: description covers all trigger keywords? SKILL.md < 500 lines?
- AGENTS.md: no duplication with parent AGENTS.md?

## Step 3 — Security Scan

```bash
grep -rn "password\|secret\|api_key\|token" --include="*.ts" \
  cli-mcp-core/src/ vscode-extension/src/ | grep -v ".env\|test\|spec"
```

## Step 4 — Output Report

```
## Review Report — {date}

### CLI/Core (if changed)
- [ ] Architecture: ✅/⚠️/❌
- [ ] Tests: ✅/⚠️/❌ (count passing)
- [ ] Types: ✅/⚠️/❌

### Extension (if changed)
- [ ] Disposables: ✅/⚠️/❌
- [ ] Bundle size: XXkB
- [ ] API compat: ✅/⚠️/❌

### Findings
{file:line — description}

### Verdict: Ship / Revise / Block
```

```

````
