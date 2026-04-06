#!/bin/bash
set -e
SCORE=0
TOTAL=100

FILE="/tmp/replay-test/src/processor.ts"
[ -f "$FILE" ] || { echo "SCORE: 0/$TOTAL"; exit 1; }

# Bug 1 (20pts): == null/undefined replaced with === or stricter check
if ! grep -qE "==\s*null|==\s*undefined" "$FILE" || grep -qE "===\s*null|===\s*undefined|!event\." "$FILE"; then
    # Check that loose equality is gone
    LOOSE=$(grep -cE "==\s*null|==\s*undefined" "$FILE" || true)
    STRICT=$(grep -cE "===\s*null|===\s*undefined" "$FILE" || true)
    if [ "$STRICT" -gt 0 ] || [ "$LOOSE" -eq 0 ]; then
        SCORE=$((SCORE + 20))
    fi
fi

# Bug 2 (20pts): Loop starts at 0, not 1
if grep -qE "let i = 0|i = 0;|for.*of events|\.forEach|\.reduce|\.filter" "$FILE" && ! grep -q "let i = 1;" "$FILE"; then
    SCORE=$((SCORE + 20))
fi

# Bug 3 (20pts): Division by zero handled
if grep -qE "count === 0|count > 0|count !==|count == 0|Math\.max.*1.*count|\|\| 1|\?\? 0" "$FILE"; then
    SCORE=$((SCORE + 20))
fi

# Bug 4 (20pts): Memory leak — listeners cleaned or bounded
if grep -qE "listeners\.length = 0|listeners\.splice|listeners = \[\]|removeListener|listeners\.clear" "$FILE"; then
    SCORE=$((SCORE + 20))
fi

# Bug 5 (20pts): fetchAndProcess properly awaits
if grep -qE "await fetch|const (response|res|data) = await" "$FILE"; then
    SCORE=$((SCORE + 20))
fi

echo "SCORE: $SCORE/$TOTAL"
echo "{\"score\":$SCORE,\"total\":$TOTAL}" > /tmp/replay-test/result.json
[ $SCORE -ge 60 ] && exit 0 || exit 1
