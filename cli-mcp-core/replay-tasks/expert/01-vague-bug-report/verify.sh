#!/bin/bash
WORKSPACE="${1:-$WORKSPACE}"
set -e
SCORE=0
TOTAL=100

CACHE="$WORKSPACE/src/cache/store.ts"
[ -f "$CACHE" ] || { echo "SCORE: 0/$TOTAL"; exit 1; }

# Check 1 (40pts): Le fix est dans cache/store.ts (le bon fichier)
TOTAL_CHECKS=0
if git diff --name-only 2>/dev/null | grep -q "cache/store" || [ "$(stat -c%Y "$CACHE" 2>/dev/null || stat -f%m "$CACHE" 2>/dev/null)" -gt "$(date -d '2 minutes ago' +%s 2>/dev/null || echo 0)" ]; then
    SCORE=$((SCORE + 40))
fi

# Check 2 (30pts): Race condition pattern resolved (mutex/lock/await/atomic/synchronized)
if grep -qE "mutex|lock|await.*delete|Promise|atomic|semaphore|synchronized|queued" "$CACHE"; then
    SCORE=$((SCORE + 30))
fi

# Check 3 (15pts): isRefreshing flag replaced with proper synchronization
if ! grep -q "isRefreshing = true" "$CACHE"; then
    SCORE=$((SCORE + 15))
fi

# Check 4 (15pts): No SQL injection in db/users.ts (bonus — secondary finding)
USERS="$WORKSPACE/src/db/users.ts"
if grep -qE "parameterized|\\\$1|prepared|placeholder" "$USERS" 2>/dev/null || ! grep -q "'\${id}'" "$USERS" 2>/dev/null; then
    SCORE=$((SCORE + 15))
fi

echo "SCORE: $SCORE/$TOTAL"
echo "{\"score\":$SCORE,\"total\":$TOTAL}" > $WORKSPACE/result.json
[ $SCORE -ge 40 ] && exit 0 || exit 1
