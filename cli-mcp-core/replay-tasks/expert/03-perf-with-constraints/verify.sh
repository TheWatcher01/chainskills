#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
set -e
SCORE=0
TOTAL=100

BUILDER="$WORKSPACE/src/services/reportBuilder.ts"
API="$WORKSPACE/src/api/reports.ts"
[ -f "$BUILDER" ] || { echo "SCORE: 0/$TOTAL"; exit 1; }

# Check 1 (30pts): Triple nested loop removed — should use single-pass aggregation
# Look for Map/object accumulator pattern instead of nested filter loops
if grep -qE "new Map|reduce\(|forEach.*\+=" "$BUILDER" && ! grep -qE "for.*of categories.*for.*of regions" "$BUILDER"; then
    SCORE=$((SCORE + 30))
fi

# Check 2 (25pts): Bubble sort replaced with Array.sort or better
if ! grep -qE "for.*let j|for.*j <.*length.*-.*i" "$BUILDER"; then
    SCORE=$((SCORE + 25))
fi

# Check 3 (20pts): No caching added (constraint respected)
# Must NOT introduce persistent caching of data
if ! grep -qE "const cache|let cache|private cache|memoize|Cache\b" "$BUILDER" "$API" 2>/dev/null; then
    SCORE=$((SCORE + 20))
fi

# Check 4 (15pts): No new dependencies imported
if ! grep -qE "import.*from 'lodash|import.*from 'ramda|require\(" "$BUILDER" "$API" 2>/dev/null; then
    SCORE=$((SCORE + 15))
fi

# Check 5 (10pts): Output structure preserved (ReportRow shape)
if grep -qE "category.*region.*totalAmount|ReportRow" "$BUILDER"; then
    SCORE=$((SCORE + 10))
fi

echo "SCORE: $SCORE/$TOTAL"
echo "{\"score\":$SCORE,\"total\":$TOTAL}" > "$WORKSPACE/result.json"
[ $SCORE -ge 55 ] && exit 0 || exit 1
