#!/usr/bin/env bash
# chainskills — PostToolUse — Post-Edit Check Hook
# Runs TypeScript type-check on modified files after every editFiles call.
# Reports errors as contextMessage (informational, not blocking).
# stdin:  { "tool": "editFiles", "parameters": { ... }, "result": { ... } }
# stdout: { "contextMessage": "..." }

set -uo pipefail

WORKSPACE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

input=$(cat)

# Extract which package(s) were touched
touched_core=$(printf '%s' "${input}" | grep -o '"cli-mcp-core/[^"]*"' | head -1 || true)
touched_ext=$(printf '%s' "${input}" | grep -o '"vscode-extension/[^"]*"' | head -1 || true)

RESULTS=""

# Run tsc type-check for cli-mcp-core if any of its files were touched
if [[ -n "${touched_core}" ]]; then
  tsc_output=$(cd "${WORKSPACE}/cli-mcp-core" && pnpm exec tsc --noEmit 2>&1 | head -30 || true)
  if [[ -n "${tsc_output}" ]]; then
    RESULTS="${RESULTS}
### cli-mcp-core TypeScript errors:
\`\`\`
${tsc_output}
\`\`\`"
  else
    RESULTS="${RESULTS}
✅ cli-mcp-core: TypeScript OK"
  fi
fi

# Run tsc type-check for vscode-extension if any of its files were touched
if [[ -n "${touched_ext}" ]]; then
  tsc_output=$(cd "${WORKSPACE}/vscode-extension" && pnpm exec tsc --noEmit 2>&1 | head -30 || true)
  if [[ -n "${tsc_output}" ]]; then
    RESULTS="${RESULTS}
### vscode-extension TypeScript errors:
\`\`\`
${tsc_output}
\`\`\`"
  else
    RESULTS="${RESULTS}
✅ vscode-extension: TypeScript OK"
  fi
fi

if [[ -z "${RESULTS}" ]]; then
  # No TypeScript packages touched — just pass through silently
  echo '{}'
  exit 0
fi

CONTEXT="## Post-Edit Type Check${RESULTS}"

printf '%s' "${CONTEXT}" | python3 -c "
import sys, json
msg = sys.stdin.read()
print(json.dumps({'contextMessage': msg}))
"
