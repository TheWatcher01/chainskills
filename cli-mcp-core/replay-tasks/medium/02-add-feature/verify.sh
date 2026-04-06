#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
set -e
FILE="$WORKSPACE/logger.ts"
[ -f "$FILE" ] || { echo "FAIL: logger.ts manquant"; exit 1; }

# Parametre data optionnel
grep -qE "data\?.*Record|data\?.*object|data\?" "$FILE" || { echo "FAIL: pas de parametre data"; exit 1; }

# Mode JSON
grep -qi "json" "$FILE" || { echo "FAIL: pas de mode JSON"; exit 1; }

# Timestamp
grep -qi "timestamp\|Date\|toISOString\|Date.now" "$FILE" || { echo "FAIL: pas de timestamp"; exit 1; }

# Mode fichier (writeFile ou appendFile)
grep -qE "writeFile|appendFile|createWriteStream|writeSync|appendFileSync" "$FILE" || { echo "FAIL: pas de mode fichier"; exit 1; }

# Retro-compatible (constructeur accepte toujours un string)
grep -qE "constructor.*level|constructor.*options|constructor.*LogLevel" "$FILE" || { echo "FAIL: constructeur casse"; exit 1; }

echo "PASS: medium/02-add-feature"
