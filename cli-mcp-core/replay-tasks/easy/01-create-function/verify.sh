#!/bin/bash
set -e
FILE="/tmp/replay-test/slugify.ts"

# Fichier existe
[ -f "$FILE" ] || { echo "FAIL: fichier manquant"; exit 1; }

# Contient export
grep -q "export" "$FILE" || { echo "FAIL: pas d'export"; exit 1; }

# Contient la signature
grep -q "slugify" "$FILE" || { echo "FAIL: pas de fonction slugify"; exit 1; }

# Contient string en minuscules
grep -q "toLowerCase\|toLowerCase()" "$FILE" || { echo "FAIL: pas de toLowerCase"; exit 1; }

# Contient remplacement d'espaces
grep -q "replace\|replaceAll" "$FILE" || { echo "FAIL: pas de replace"; exit 1; }

echo "PASS: 01-create-function"
