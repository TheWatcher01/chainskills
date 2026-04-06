#!/bin/bash
set -e
BASE="/tmp/replay-test/src"

# 4 fichiers existent
[ -f "$BASE/core/projection.port.ts" ] || { echo "FAIL: projection.port.ts manquant"; exit 1; }
[ -f "$BASE/adapters/memory-projection-store.ts" ] || { echo "FAIL: memory-projection-store.ts manquant"; exit 1; }
[ -f "$BASE/cli/project.ts" ] || { echo "FAIL: project.ts manquant"; exit 1; }

# Test existe (dans core ou a la racine)
TEST=$(find /tmp/replay-test -name "*projection*test*" -o -name "*test*projection*" 2>/dev/null | head -1)
[ -n "$TEST" ] || { echo "FAIL: fichier test manquant"; exit 1; }

# Architecture hexagonale : core ne depend pas d'adapters
if grep -r "adapters\|memory-projection" "$BASE/core/" 2>/dev/null | grep -v "test" | grep -q "import"; then
    echo "FAIL: violation hexagonale — core importe adapters"
    exit 1
fi

# Interface Projection existe
grep -q "interface Projection" "$BASE/core/projection.port.ts" || { echo "FAIL: pas d'interface Projection"; exit 1; }

# Interface ProjectionStore existe
grep -qE "interface ProjectionStore|ProjectionStore" "$BASE/core/projection.port.ts" || { echo "FAIL: pas d'interface ProjectionStore"; exit 1; }

# Implementation existe
grep -q "createMemoryProjectionStore\|MemoryProjectionStore\|class.*ProjectionStore" "$BASE/adapters/memory-projection-store.ts" || { echo "FAIL: pas d'implementation"; exit 1; }

# Test a des assertions
COUNT=$(grep -c "expect\|assert\|toBe\|toEqual" "$TEST" || true)
[ "$COUNT" -ge 6 ] || { echo "FAIL: seulement $COUNT assertions (min 6)"; exit 1; }

echo "PASS: hard/01-multi-file-feature"
