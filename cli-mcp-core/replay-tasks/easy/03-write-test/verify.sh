#!/bin/bash
set -e
FILE="/tmp/replay-test/utils.test.ts"
[ -f "$FILE" ] || { echo "FAIL: fichier test manquant"; exit 1; }

# Teste les 3 fonctions
grep -q "capitalize" "$FILE" || { echo "FAIL: capitalize non teste"; exit 1; }
grep -q "truncate" "$FILE" || { echo "FAIL: truncate non teste"; exit 1; }
grep -q "isPalindrome\|palindrome" "$FILE" || { echo "FAIL: isPalindrome non teste"; exit 1; }

# Au moins 9 expect/assert
COUNT=$(grep -c "expect\|assert\|toBe\|toEqual\|strictEqual" "$FILE" || true)
[ "$COUNT" -ge 9 ] || { echo "FAIL: seulement $COUNT assertions (min 9)"; exit 1; }

echo "PASS: 03-write-test"
