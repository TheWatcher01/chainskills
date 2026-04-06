#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
set -e
SCORE=0
TOTAL=100
SRC="$WORKSPACE/src"

# Check 1 (35pts): Email validation extracted to shared util
EMAIL_DUP=$(grep -rh "email.*includes.*@" "$SRC" 2>/dev/null | wc -l)
BEFORE=$(cat "$WORKSPACE/.dup-before-email" 2>/dev/null || echo 3)
if [ "$EMAIL_DUP" -lt "$BEFORE" ]; then
    SCORE=$((SCORE + 35))
fi

# Check 2 (35pts): Date formatting extracted to shared util
DATE_DUP=$(grep -rh "getFullYear.*getMonth\|getMonth.*getDate" "$SRC" 2>/dev/null | wc -l)
BEFORE_DATE=$(cat "$WORKSPACE/.dup-before-date" 2>/dev/null || echo 3)
if [ "$DATE_DUP" -lt "$BEFORE_DATE" ]; then
    SCORE=$((SCORE + 35))
fi

# Check 3 (15pts): A shared/utils file was created
if find "$SRC" -name "*.ts" | xargs grep -l "export.*function.*validate\|export.*function.*format" 2>/dev/null | grep -qE "shared|common|utils"; then
    SCORE=$((SCORE + 15))
fi

# Check 4 (15pts): Original modules still export their functions (backward compat)
EXPORTS=$(grep -rh "export.*function" "$SRC/orders/" "$SRC/payments/" "$SRC/shipping/" 2>/dev/null | wc -l)
[ "$EXPORTS" -ge 3 ] && SCORE=$((SCORE + 15))

echo "SCORE: $SCORE/$TOTAL"
echo "{\"score\":$SCORE,\"total\":$TOTAL}" > "$WORKSPACE/result.json"
[ $SCORE -ge 35 ] && exit 0 || exit 1
