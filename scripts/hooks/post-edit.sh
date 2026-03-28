#!/usr/bin/env bash
# chainskills — PostToolUse — Post-Edit Check Hook
# Runs TypeScript type-check on modified files after every edit.
# Compatible: VS Code Copilot (parameters) + Claude Code (tool_input)
# stdin:  JSON with tool parameters/result
# stdout: { "contextMessage": "..." }

set -uo pipefail

WORKSPACE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

input=$(cat)

# Detect which package(s) were touched
touched_core=$(printf '%s' "${input}" | grep -o '"cli-mcp-core/[^"]*"' | head -1 || true)
touched_ext=$(printf '%s' "${input}" | grep -o '"vscode-extension/[^"]*"' | head -1 || true)

# Also check Claude Code format (file_path field)
if [[ -z "${touched_core}" ]]; then
  touched_core=$(printf '%s' "${input}" | grep -o 'cli-mcp-core/' | head -1 || true)
fi
if [[ -z "${touched_ext}" ]]; then
  touched_ext=$(printf '%s' "${input}" | grep -o 'vscode-extension/' | head -1 || true)
fi

RESULTS=""

if [[ -n "${touched_core}" ]]; then
  tsc_output=$(cd "${WORKSPACE}/cli-mcp-core" && pnpm exec tsc --noEmit 2>&1 | head -30 || true)
  if [[ -n "${tsc_output}" ]]; then
    RESULTS="${RESULTS}cli-mcp-core TypeScript errors: ${tsc_output}"
  else
    RESULTS="${RESULTS}cli-mcp-core: TypeScript OK. "
  fi
fi

if [[ -n "${touched_ext}" ]]; then
  tsc_output=$(cd "${WORKSPACE}/vscode-extension" && pnpm exec tsc --noEmit 2>&1 | head -30 || true)
  if [[ -n "${tsc_output}" ]]; then
    RESULTS="${RESULTS}vscode-extension TypeScript errors: ${tsc_output}"
  else
    RESULTS="${RESULTS}vscode-extension: TypeScript OK. "
  fi
fi

if [[ -z "${RESULTS}" ]]; then
  echo '{}'
  exit 0
fi

# Output contextMessage
printf '%s' "${RESULTS}" | node -e "
const msg=require('fs').readFileSync('/dev/stdin','utf8');
console.log(JSON.stringify({contextMessage:'Post-Edit Type Check: '+msg}));
"
