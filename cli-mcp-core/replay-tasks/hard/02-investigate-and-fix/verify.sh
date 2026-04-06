#!/bin/bash
set -e
FILE="/tmp/replay-test/server.ts"
AUDIT="/tmp/replay-test/AUDIT.md"

[ -f "$FILE" ] || { echo "FAIL: server.ts manquant"; exit 1; }
[ -f "$AUDIT" ] || { echo "FAIL: AUDIT.md manquant"; exit 1; }

# AUDIT a au moins 5 problemes
LINES=$(wc -l < "$AUDIT")
[ "$LINES" -ge 6 ] || { echo "FAIL: AUDIT.md trop court ($LINES lignes, min 6)"; exit 1; }

# Content-Type
grep -qi "content-type\|application/json" "$FILE" || { echo "FAIL: pas de Content-Type"; exit 1; }

# UUID au lieu de Math.random
grep -qE "randomUUID|crypto|uuid|nanoid" "$FILE" || { echo "FAIL: pas d'UUID"; exit 1; }

# Validation input
grep -qE "!name|!email|validate|required|[Mm]issing" "$FILE" || { echo "FAIL: pas de validation input"; exit 1; }

# GET /users/:id — au moins 2 endpoints GET
METHODS=$(grep -cE "method.*GET|GET.*method" "$FILE" || true)
[ "$METHODS" -ge 2 ] || { echo "FAIL: pas de GET /users/:id (seulement $METHODS GET endpoints)"; exit 1; }

# try/catch
grep -q "try" "$FILE" || { echo "FAIL: pas de try/catch"; exit 1; }

echo "PASS: hard/02-investigate-and-fix"
