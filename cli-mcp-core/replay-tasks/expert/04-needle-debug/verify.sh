#!/bin/bash
set -e
SCORE=0
TOTAL=100

ITEMS="/tmp/replay-test/src/db/items.ts"
[ -f "$ITEMS" ] || { echo "SCORE: 0/$TOTAL"; exit 1; }

# Check 1 (50pts): Fix is in the correct file (db/items.ts)
# The offset formula should use (page - 1) * pageSize
if grep -qE "\(page\s*-\s*1\)\s*\*\s*pageSize|page\s*-\s*1.*\*|offset\s*=.*-\s*1" "$ITEMS"; then
    SCORE=$((SCORE + 50))
fi

# Check 2 (25pts): The original buggy line is removed
if ! grep -q "const offset = page \* pageSize;" "$ITEMS"; then
    SCORE=$((SCORE + 25))
fi

# Check 3 (15pts): SQL injection also addressed (bonus)
if grep -qE "\\\$[0-9]|parameterized|prepared" "$ITEMS" && ! grep -q '${sort}' "$ITEMS"; then
    SCORE=$((SCORE + 15))
fi

# Check 4 (10pts): No other files broken (index.ts still exports)
if grep -q "export.*handleListItems\|export.*getItems\|export.*findItems" /tmp/replay-test/src/index.ts 2>/dev/null; then
    SCORE=$((SCORE + 10))
fi

echo "SCORE: $SCORE/$TOTAL"
echo "{\"score\":$SCORE,\"total\":$TOTAL}" > /tmp/replay-test/result.json
[ $SCORE -ge 50 ] && exit 0 || exit 1
