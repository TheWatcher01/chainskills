#!/usr/bin/env bash
# chainskills — SessionStart Hook
# Injects monorepo architecture context into every new Copilot Chat session.
# stdin:  { "sessionId": "..." }
# stdout: { "contextMessage": "..." }

set -euo pipefail

WORKSPACE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Build context message from AGENTS.md (first 60 lines = monorepo summary)
AGENTS_SUMMARY=$(head -60 "${WORKSPACE}/AGENTS.md" 2>/dev/null || echo "")

# Get current git branch for context
BRANCH=$(git -C "${WORKSPACE}" branch --show-current 2>/dev/null || echo "unknown")

# Compose the context injection
CONTEXT="## chainskills Session Context

**Branch**: \`${BRANCH}\`
**Monorepo**: cli-mcp-core/ (TypeScript CLI + MCP) + vscode-extension/ (VS Code extension)
**Architecture**: Hexagonal — Ports & Adapters. Dependencies point inward: adapters → core, NEVER reverse.
**Package manager**: pnpm exclusively (never npm).
**Build**: \`cd cli-mcp-core && pnpm build\` | \`cd vscode-extension && pnpm compile\`
**Tests**: \`cd cli-mcp-core && pnpm test\` (197 Vitest tests)

### Dependency Rule (enforced)
- \`src/core/\` — ZERO external dependencies, Result<T,E> error pattern
- \`src/adapters/\` — Implement core ports, may use infrastructure
- Never import from adapters inside core/

### Agent Roster
Research | Architect | Review | Orchestrator | Extension | CopilotExpert

---
${AGENTS_SUMMARY}"

# Output JSON — contextMessage is injected as system context for this session
printf '%s' "${CONTEXT}" | python3 -c "
import sys, json
msg = sys.stdin.read()
print(json.dumps({'contextMessage': msg}))
"
