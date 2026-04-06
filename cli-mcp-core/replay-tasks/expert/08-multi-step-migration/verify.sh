#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
set -e
SCORE=0
TOTAL=100

SRC="$WORKSPACE/src"
[ -d "$SRC" ] || { echo "SCORE: 0/$TOTAL"; exit 1; }

# Check 1 (25pts): No Express imports remain
EXPRESS_IMPORTS=$(grep -rE "from 'express'|from \"express\"|require.*express" "$SRC/" 2>/dev/null | wc -l)
[ "$EXPRESS_IMPORTS" -eq 0 ] && SCORE=$((SCORE + 25))

# Check 2 (25pts): Fastify imports present
if grep -rqE "from 'fastify'|from \"fastify\"|fastify" "$SRC/" 2>/dev/null; then
    SCORE=$((SCORE + 25))
fi

# Check 3 (20pts): Middleware converted to hooks/decorators
# Express patterns like (req, res, next) should be replaced with Fastify hooks
if ! grep -rq "NextFunction" "$SRC/" 2>/dev/null; then
    # Check for Fastify hook patterns
    if grep -rqE "onRequest|preHandler|preValidation|addHook|decorate" "$SRC/" 2>/dev/null; then
        SCORE=$((SCORE + 20))
    fi
fi

# Check 4 (15pts): All routes preserved (GET /users, GET /users/:id, POST /users, DELETE /users/:id, GET /health)
ROUTES=0
grep -rqE "get.*'/users'" "$SRC/" 2>/dev/null && ROUTES=$((ROUTES + 1))
grep -rqE "get.*'/users/:id'|get.*'/users/'" "$SRC/" 2>/dev/null && ROUTES=$((ROUTES + 1))
grep -rqE "post.*'/users'" "$SRC/" 2>/dev/null && ROUTES=$((ROUTES + 1))
grep -rqE "delete.*'/users'" "$SRC/" 2>/dev/null && ROUTES=$((ROUTES + 1))
grep -rqE "get.*'/health'" "$SRC/" 2>/dev/null && ROUTES=$((ROUTES + 1))
[ "$ROUTES" -ge 4 ] && SCORE=$((SCORE + 15))

# Check 5 (15pts): Types file preserved and db/store still works
if [ -f "$SRC/types.ts" ] && [ -f "$SRC/db/store.ts" ]; then
    grep -q "interface User" "$SRC/types.ts" && SCORE=$((SCORE + 15))
fi

echo "SCORE: $SCORE/$TOTAL"
echo "{\"score\":$SCORE,\"total\":$TOTAL}" > "$WORKSPACE/result.json"
[ $SCORE -ge 50 ] && exit 0 || exit 1
