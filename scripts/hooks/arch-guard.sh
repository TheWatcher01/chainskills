#!/usr/bin/env bash
# chainskills — PreToolUse — Architecture Guard Hook
# Enforces Hexagonal Architecture Dependency Rule before any file edit.
# Blocks edits that would import from adapters inside core/.
# Compatible: VS Code Copilot (parameters) + Claude Code (tool_input)
# stdin:  JSON with tool parameters
# stdout: { "decision": "allow"|"block", "reason": "..." }
# exit 2: hard block

set -euo pipefail

WORKSPACE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

input=$(cat)

# Extract file paths — dual-compatible: tool_input (Claude Code) or parameters (Copilot)
files=$(printf '%s' "${input}" | node -e "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const p=d.tool_input||d.parameters||{};
const files=p.files||p.file_path?[p.file_path||p.filePath]:[];
if(Array.isArray(files)){files.forEach(f=>{
  if(typeof f==='object')console.log(f.filePath||f.file_path||'');
  else if(typeof f==='string')console.log(f);
})}
if(typeof p.file_path==='string')console.log(p.file_path);
" 2>/dev/null || true)

VIOLATIONS=""

while IFS= read -r filepath; do
  [[ -z "${filepath}" ]] && continue

  # Skip files outside the chainskills workspace
  if [[ "${filepath}" == /* ]] && [[ "${filepath}" != "${WORKSPACE}"/* ]]; then
    continue
  fi

  # Only check files inside src/core/
  if [[ "${filepath}" == *"/src/core/"* ]]; then
    existing_content=""
    abs_path="${filepath}"
    [[ ! "${abs_path}" = /* ]] && abs_path="${WORKSPACE}/${filepath}"
    if [[ -f "${abs_path}" ]]; then
      existing_content=$(cat "${abs_path}" 2>/dev/null || true)
    fi

    # Check for adapter imports
    if echo "${existing_content}" | grep -qE "from '.*adapters/|from \".*adapters/|require\('.*adapters/"; then
      VIOLATIONS="${VIOLATIONS}\n  ${filepath}: imports from adapters/ (violates Dependency Rule)"
    fi
  fi
done <<< "${files}"

if [[ -n "${VIOLATIONS}" ]]; then
  REASON="Hexagonal Architecture Violation: core/ files import from adapters/.${VIOLATIONS} Fix: use a port interface in core/ports/ and inject via DI."
  printf '{"decision":"block","reason":"%s"}' "$(printf '%s' "${REASON}" | sed 's/"/\\"/g' | tr '\n' ' ')"
  exit 2
fi

echo '{"decision":"allow"}'
