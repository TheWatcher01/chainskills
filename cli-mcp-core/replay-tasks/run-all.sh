#!/bin/bash
# run-all.sh — Execute tous les verify.sh et genere un rapport
#
# Usage: bash replay-tasks/run-all.sh [easy|medium|hard]
#
# Lance setup.sh puis verify.sh pour chaque tache.
# Genere un rapport JSON dans /tmp/replay-report.json

set -uo pipefail

TASKS_DIR="$(cd "$(dirname "$0")" && pwd)"
FILTER="${1:-}"
REPORT="/tmp/replay-report.json"

PASS=0
FAIL=0
RESULTS="["

for difficulty in easy medium hard; do
    # Filtre optionnel
    [ -n "$FILTER" ] && [ "$FILTER" != "$difficulty" ] && continue

    for task_dir in "$TASKS_DIR/$difficulty"/*/; do
        [ -d "$task_dir" ] || continue
        TASK_NAME="$difficulty/$(basename "$task_dir")"

        # Setup
        if [ -f "$task_dir/setup.sh" ]; then
            bash "$task_dir/setup.sh" 2>/dev/null
        fi

        # Verify
        if [ -f "$task_dir/verify.sh" ]; then
            OUTPUT=$(bash "$task_dir/verify.sh" 2>&1)
            EXIT_CODE=$?

            if [ $EXIT_CODE -eq 0 ]; then
                PASS=$((PASS + 1))
                STATUS="pass"
                echo "  ✓ $TASK_NAME"
            else
                FAIL=$((FAIL + 1))
                STATUS="fail"
                echo "  ✗ $TASK_NAME — $OUTPUT"
            fi

            RESULTS="$RESULTS{\"task\":\"$TASK_NAME\",\"status\":\"$STATUS\",\"output\":\"$(echo "$OUTPUT" | head -1)\"},"
        fi
    done
done

# Fermer le JSON
RESULTS="${RESULTS%,}]"
TOTAL=$((PASS + FAIL))

echo ""
echo "═══════════════════════════════════"
echo "  Results: $PASS/$TOTAL passed"
echo "  Pass rate: $(( TOTAL > 0 ? PASS * 100 / TOTAL : 0 ))%"
echo "═══════════════════════════════════"

# Sauvegarder le rapport
cat > "$REPORT" << JSONEOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "total": $TOTAL,
  "pass": $PASS,
  "fail": $FAIL,
  "pass_rate": $(( TOTAL > 0 ? PASS * 100 / TOTAL : 0 )),
  "results": $RESULTS
}
JSONEOF

echo "  Report: $REPORT"
