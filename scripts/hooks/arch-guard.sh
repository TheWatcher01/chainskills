#!/usr/bin/env bash
# chainskills — PreToolUse — Architecture Guard Hook
# Enforces Hexagonal Architecture Dependency Rule before any file edit.
# Blocks edits that would import from adapters inside core/.
# stdin:  { "tool": "editFiles", "parameters": { "files": [...] } }
# stdout: { "decision": "allow"|"block", "message": "..." }
# exit 2: hard block (VS Code will not execute the tool)

set -euo pipefail

WORKSPACE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

input=$(cat)

# Extract file paths being edited from the parameters JSON
# Look for files inside src/core/ being edited
files=$(printf '%s' "${input}" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    params = data.get('parameters', {})
    # editFiles uses 'files' or 'edits' array
    files = params.get('files', [])
    if isinstance(files, list):
        for f in files:
            if isinstance(f, dict):
                print(f.get('filePath', ''))
            elif isinstance(f, str):
                print(f)
except:
    pass
" 2>/dev/null || true)

VIOLATIONS=""

while IFS= read -r filepath; do
  [[ -z "${filepath}" ]] && continue

  # Only check files inside cli-mcp-core/src/core/
  if [[ "${filepath}" == *"cli-mcp-core/src/core/"* ]] || [[ "${filepath}" == *"/src/core/"* ]]; then
    # Check if the file content (from input) or existing file imports from adapters
    existing_content=""
    if [[ -f "${WORKSPACE}/${filepath}" ]]; then
      existing_content=$(cat "${WORKSPACE}/${filepath}" 2>/dev/null || true)
    fi

    # Also check the new content from the edit parameters
    new_content=$(printf '%s' "${input}" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    params = data.get('parameters', {})
    files = params.get('files', [])
    for f in files:
        if isinstance(f, dict) and '${filepath}' in f.get('filePath', ''):
            print(f.get('content', ''))
except:
    pass
" 2>/dev/null || true)

    # Check new content for adapter imports
    check_content="${new_content:-${existing_content}}"
    if echo "${check_content}" | grep -qE "from '.*adapters/|from \".*adapters/|require\('.*adapters/"; then
      VIOLATIONS="${VIOLATIONS}\n  ⛔ ${filepath}: imports from adapters/ (violates Dependency Rule)"
    fi
  fi
done <<< "${files}"

if [[ -n "${VIOLATIONS}" ]]; then
  MESSAGE="🏛️ Hexagonal Architecture Violation Detected

The following files in core/ attempt to import from adapters/, which violates the Dependency Rule (dependencies must point inward: adapters → core, never reverse):
${VIOLATIONS}

Fix: Move the dependency to an output port (interface) in core/ports/ and inject the adapter via DI.
Reference: AGENTS.md — Dependency Rule"

  printf '%s' "${MESSAGE}" | python3 -c "
import sys, json
msg = sys.stdin.read()
print(json.dumps({'decision': 'block', 'message': msg}))
"
  exit 2
fi

# Allow the edit
echo '{"decision": "allow"}'
