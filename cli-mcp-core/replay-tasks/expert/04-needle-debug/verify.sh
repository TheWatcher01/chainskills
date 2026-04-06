#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
set -e
SCORE=0
TOTAL=100

ITEMS="$WORKSPACE/src/db/items.ts"
[ -f "$ITEMS" ] || { echo "SCORE: 0/$TOTAL"; exit 1; }

# Check 1 (50pts): Fix is in actual code (not comments) — (page - 1) * pageSize
# Strip comments first, then check for the fix pattern
CODE_ONLY=$(grep -v "^\s*//" "$ITEMS")
if echo "$CODE_ONLY" | grep -qE "\(page\s*-\s*1\)\s*\*\s*pageSize"; then
    SCORE=$((SCORE + 50))
fi

# Check 2 (25pts): The original buggy line is removed from code
if ! echo "$CODE_ONLY" | grep -q "= page \* pageSize"; then
    SCORE=$((SCORE + 25))
fi

# Check 3 (15pts): SQL injection also addressed (bonus)
if echo "$CODE_ONLY" | grep -qE "\\\$[0-9]|parameterized|prepared" && ! echo "$CODE_ONLY" | grep -q '${sort}'; then
    SCORE=$((SCORE + 15))
fi

# Check 4 (10pts): No other files broken (index.ts still exports)
if grep -q "export.*handleListItems\|export.*getItems\|export.*findItems" "$WORKSPACE/src/index.ts" 2>/dev/null; then
    SCORE=$((SCORE + 10))
fi

echo "SCORE: $SCORE/$TOTAL"
echo "{\"score\":$SCORE,\"total\":$TOTAL}" > "$WORKSPACE/result.json"
[ $SCORE -ge 50 ] && exit 0 || exit 1
