#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
set -e
SCORE=0
TOTAL=100

CACHE="$WORKSPACE/src/cache/store.ts"
[ -f "$CACHE" ] || { echo "SCORE: 0/$TOTAL"; exit 1; }

# Save original hash at setup time for comparison
ORIG_HASH="$WORKSPACE/.cache-store-hash"

# Check 1 (40pts): The file was actually modified (content differs from setup)
if [ -f "$ORIG_HASH" ]; then
    CURRENT_HASH=$(sha256sum "$CACHE" | cut -d' ' -f1)
    SAVED_HASH=$(cat "$ORIG_HASH")
    if [ "$CURRENT_HASH" != "$SAVED_HASH" ]; then
        SCORE=$((SCORE + 40))
    fi
else
    # No hash file = can't verify modification, give 0
    :
fi

# Check 2 (30pts): Race condition actually fixed — need NEW synchronization pattern
# (not just `async function` which returns Promise in the original)
# Must have ADDED a lock/mutex/queue/Map-based guard that wasn't there before
CODE_ONLY=$(grep -v "^\s*//" "$CACHE")
if echo "$CODE_ONLY" | grep -qE "mutex|Lock|lock\(|await.*invalidat|queue|semaphore|synchronized|Map.*pending|pending.*Map"; then
    SCORE=$((SCORE + 30))
fi

# Check 3 (15pts): isRefreshing flag removed or replaced with proper sync
if ! grep -q "isRefreshing = true" "$CACHE"; then
    SCORE=$((SCORE + 15))
fi

# Check 4 (15pts): No SQL injection in db/users.ts (bonus — secondary finding)
USERS="$WORKSPACE/src/db/users.ts"
if [ -f "$USERS" ]; then
    CODE_USERS=$(grep -v "^\s*//" "$USERS")
    # Must use parameterized query AND not have '${id}' interpolation
    if echo "$CODE_USERS" | grep -qE "\\\$1|parameterized|prepared|placeholder" && ! echo "$CODE_USERS" | grep -q "'\${id}'"; then
        SCORE=$((SCORE + 15))
    fi
fi

echo "SCORE: $SCORE/$TOTAL"
echo "{\"score\":$SCORE,\"total\":$TOTAL}" > "$WORKSPACE/result.json"
[ $SCORE -ge 40 ] && exit 0 || exit 1
