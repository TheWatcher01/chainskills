#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
set -e
FILE="$WORKSPACE/calculator.ts"
[ -f "$FILE" ] || { echo "FAIL: fichier manquant"; exit 1; }

# add doit utiliser + pas -
grep -q "a + b\|a+b" "$FILE" || { echo "FAIL: add pas corrige"; exit 1; }

# divide doit gerer b === 0
grep -q "=== 0\|== 0\|!b\|b === 0" "$FILE" || { echo "FAIL: divide pas corrige"; exit 1; }

# average doit gerer tableau vide
grep -q "length === 0\|length == 0\|\.length < 1\|!numbers.length" "$FILE" || { echo "FAIL: average pas corrige"; exit 1; }

echo "PASS: 02-fix-bug"
