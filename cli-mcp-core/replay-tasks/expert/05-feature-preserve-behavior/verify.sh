#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
set -e
SCORE=0
TOTAL=100

FILE="$WORKSPACE/src/formatter.ts"
TEST="$WORKSPACE/tests/formatter.test.ts"
[ -f "$FILE" ] || { echo "SCORE: 0/$TOTAL"; exit 1; }

# Check 1 (25pts): CSV format support added
if grep -qE "csv|CSV" "$FILE"; then
    SCORE=$((SCORE + 25))
fi

# Check 2 (25pts): format() accepts outputFormat parameter
if grep -qE "outputFormat|format.*csv|'csv'|\"csv\"" "$FILE"; then
    SCORE=$((SCORE + 25))
fi

# Check 3 (20pts): CSV output uses comma separation and newlines
if grep -qE "join.*,|\\\\n|comma|separator" "$FILE"; then
    SCORE=$((SCORE + 20))
fi

# Check 4 (15pts): Original functions still exist (backward compat)
FUNCS=0
grep -q "function format(" "$FILE" && FUNCS=$((FUNCS + 1))
grep -q "function formatSingle(" "$FILE" && FUNCS=$((FUNCS + 1))
grep -q "function parse(" "$FILE" && FUNCS=$((FUNCS + 1))
grep -q "function getHeaders(" "$FILE" && FUNCS=$((FUNCS + 1))
grep -q "function filterByField(" "$FILE" && FUNCS=$((FUNCS + 1))
grep -q "function sortByField(" "$FILE" && FUNCS=$((FUNCS + 1))
[ "$FUNCS" -ge 6 ] && SCORE=$((SCORE + 15))

# Check 5 (15pts): Original test file not deleted/broken
if [ -f "$TEST" ]; then
    ORIG_TESTS=$(grep -c "it(" "$TEST" || true)
    [ "$ORIG_TESTS" -ge 12 ] && SCORE=$((SCORE + 15))
fi

echo "SCORE: $SCORE/$TOTAL"
echo "{\"score\":$SCORE,\"total\":$TOTAL}" > "$WORKSPACE/result.json"
[ $SCORE -ge 50 ] && exit 0 || exit 1
