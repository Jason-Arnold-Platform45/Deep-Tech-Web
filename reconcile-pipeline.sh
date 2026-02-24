#!/usr/bin/env bash
# reconcile-pipeline.sh — run after all beads are closed
# Audits Results vs Verdicts vs Build Log vs Snapshot entries
# Fills any gaps caused by context pressure before final commit
set -e
ERRORS=0

RESULTS=$(ls .beads/results/ 2>/dev/null | wc -l | tr -d ' ')
VERDICTS=$(ls .beads/verdicts/ 2>/dev/null | wc -l | tr -d ' ')
LOG_ROWS=$(grep -c '|.*bd-.*|' CLAUDE.md 2>/dev/null || echo 0)
SNAPSHOT=$(grep -c 'bd-' context-snapshot.md 2>/dev/null || echo 0)

echo "=== PIPELINE RECONCILIATION ==="
echo "Result files:      $RESULTS"
echo "Verdict files:     $VERDICTS"
echo "Build Log rows:    $LOG_ROWS"
echo "Snapshot entries:  $SNAPSHOT"

# Find result files with no matching verdict
for f in .beads/results/*.json; do
  [ -f "$f" ] || continue
  ID=$(jq -r '.beadId' "$f" 2>/dev/null)
  [ -z "$ID" ] && continue
  if [ ! -f ".beads/verdicts/${ID}.json" ]; then
    echo "⚠️  MISSING VERDICT: $ID — write verdict file before committing"
    ERRORS=$((ERRORS + 1))
  fi
  if ! grep -q "$ID" CLAUDE.md 2>/dev/null; then
    echo "⚠️  MISSING BUILD LOG ROW: $ID — add row to CLAUDE.md Build Log"
    ERRORS=$((ERRORS + 1))
  fi
  if ! grep -q "$ID" context-snapshot.md 2>/dev/null; then
    echo "⚠️  MISSING SNAPSHOT ENTRY: $ID — update context-snapshot.md"
    ERRORS=$((ERRORS + 1))
  fi
done

if [ "$ERRORS" -eq 0 ]; then
  echo "✅ Pipeline parity confirmed — all counts match ($RESULTS)"
  exit 0
else
  echo "❌ $ERRORS gap(s) found — fill them before committing"
  exit 1
fi
