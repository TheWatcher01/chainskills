#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
set -e
FILE="$WORKSPACE/todo.ts"
TEST="$WORKSPACE/todo.test.ts"

[ -f "$FILE" ] || { echo "FAIL: todo.ts manquant"; exit 1; }
[ -f "$TEST" ] || { echo "FAIL: todo.test.ts manquant"; exit 1; }

# Classe existe
grep -q "class TodoManager" "$FILE" || { echo "FAIL: pas de classe TodoManager"; exit 1; }

# Export
grep -q "export" "$FILE" || { echo "FAIL: pas d'export"; exit 1; }

# Proprietes privees
grep -qE "private|#" "$FILE" || { echo "FAIL: pas de proprietes privees"; exit 1; }

# 6 methodes
for method in add toggle remove list count clear; do
    grep -qi "$method" "$FILE" || { echo "FAIL: methode $method manquante"; exit 1; }
done

# Tests
COUNT=$(grep -c "expect\|assert\|toBe\|toEqual" "$TEST" || true)
[ "$COUNT" -ge 8 ] || { echo "FAIL: seulement $COUNT assertions (min 8)"; exit 1; }

echo "PASS: medium/01-refactor-to-class"
