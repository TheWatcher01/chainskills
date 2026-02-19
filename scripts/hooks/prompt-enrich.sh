#!/usr/bin/env bash
# chainskills — UserPromptSubmit Hook
# Appends current git branch and changed files to every user prompt.
# stdin:  { "prompt": "...", "agent": "..." }
# stdout: { "contextMessage": "..." }

set -euo pipefail

WORKSPACE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Read stdin (not used to modify the prompt itself, we use contextMessage)
input=$(cat)

# Get git context
BRANCH=$(git -C "${WORKSPACE}" branch --show-current 2>/dev/null || echo "unknown")
CHANGED=$(git -C "${WORKSPACE}" status --short 2>/dev/null | head -20 || echo "")
LAST_COMMIT=$(git -C "${WORKSPACE}" log --oneline -1 2>/dev/null || echo "unknown")

# Build context enrichment
CONTEXT="**Git context**: branch=\`${BRANCH}\` | last commit: ${LAST_COMMIT}"

if [[ -n "${CHANGED}" ]]; then
  CONTEXT="${CONTEXT}
**Uncommitted changes**:
\`\`\`
${CHANGED}
\`\`\`"
fi

# Output contextMessage (appended to LLM context, not modifying the prompt text)
printf '%s' "${CONTEXT}" | python3 -c "
import sys, json
msg = sys.stdin.read()
print(json.dumps({'contextMessage': msg}))
"
