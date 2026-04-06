#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
set -e
SCORE=0
TOTAL=100

SRC="$WORKSPACE/src"
[ -d "$SRC" ] || { echo "SCORE: 0/$TOTAL"; exit 1; }

# Check 1 (35pts): The circular dependency is broken
# utils/format.ts should NOT import from services/user.ts anymore
if ! grep -q "from.*services/user" "$SRC/utils/format.ts" 2>/dev/null; then
    SCORE=$((SCORE + 35))
fi

# Check 2 (25pts): formatForCurrentUser still exists somewhere (not deleted)
if grep -rq "formatForCurrentUser" "$SRC/" 2>/dev/null; then
    SCORE=$((SCORE + 25))
fi

# Check 3 (20pts): All original exports still exist in index.ts
EXPORTS=0
for fn in formatName formatCurrency createUser getDisplayName createOrder getCurrentUser loginUser placeOrder sendWelcome; do
    if grep -q "$fn" "$SRC/index.ts" 2>/dev/null; then
        EXPORTS=$((EXPORTS + 1))
    fi
done
# At least 8 of 9 exports preserved
[ "$EXPORTS" -ge 8 ] && SCORE=$((SCORE + 20))

# Check 4 (20pts): No new circular deps introduced
# services should not import from services (except through models)
CROSS_SERVICE=$(grep -rh "from.*\.\./services/" "$SRC/utils/" 2>/dev/null | wc -l)
[ "$CROSS_SERVICE" -eq 0 ] && SCORE=$((SCORE + 20))

echo "SCORE: $SCORE/$TOTAL"
echo "{\"score\":$SCORE,\"total\":$TOTAL}" > "$WORKSPACE/result.json"
[ $SCORE -ge 60 ] && exit 0 || exit 1
