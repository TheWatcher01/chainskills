#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
set -e
FILE="$WORKSPACE/cache.ts"
TEST="$WORKSPACE/cache.test.ts"

[ -f "$FILE" ] || { echo "FAIL: cache.ts manquant"; exit 1; }
[ -f "$TEST" ] || { echo "FAIL: cache.test.ts manquant"; exit 1; }

# Verification d'expiration dans get
grep -qE "expiresAt|expired|Date\.now" "$FILE" || { echo "FAIL: pas de check expiration"; exit 1; }

# Methode cleanup
grep -q "cleanup" "$FILE" || { echo "FAIL: pas de methode cleanup"; exit 1; }

# Test file has assertions
COUNT=$(grep -c "expect\|assert\|toBe\|toEqual" "$TEST" || true)
[ "$COUNT" -ge 5 ] || { echo "FAIL: seulement $COUNT assertions (min 5)"; exit 1; }

echo "PASS: medium/03-debug-runtime"
