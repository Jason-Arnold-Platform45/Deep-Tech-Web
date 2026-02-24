#!/usr/bin/env bash
# check-result.sh — run after agent submits result, before review-agent dispatch
# Usage: bash check-result.sh <bead-id>
# Exit 0 = pass (dispatch review-agent)
# Exit 1 = fail (reject back to agent)
set -e

BEAD_ID="${1:?Usage: check-result.sh <bead-id>}"
RESULT_FILE=".beads/results/${BEAD_ID}.json"
ERRORS=0

echo "=== CHECK RESULT: $BEAD_ID ==="

# 1. Result file exists
if [ ! -f "$RESULT_FILE" ]; then
  echo "❌ Result file not found: $RESULT_FILE"
  exit 1
fi
echo "✅ Result file exists"

# 2. Check all gates in gatesPassed object
for gate in codeComplete filesSaved verifyPassed acceptanceMet noRemainingWork followsPatterns linterPassed inputValidation errorHandling noHardcodedSecrets; do
  VAL=$(jq -r ".gatesPassed.${gate}" "$RESULT_FILE")
  if [ "$VAL" != "true" ]; then
    echo "❌ gatesPassed.${gate} is not true (got: $VAL)"
    ERRORS=$((ERRORS + 1))
  fi
done
if [ "$ERRORS" -eq 0 ]; then
  echo "✅ All 10 gates passed"
fi

# 3. No TODOs
TODO_COUNT=$(jq -r '.todoCount // -1' "$RESULT_FILE")
if [ "$TODO_COUNT" != "0" ]; then
  echo "❌ todoCount is not 0 (got: $TODO_COUNT)"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ todoCount: 0"
fi

# 4. Files were modified
FILES_MODIFIED=$(jq -r '.filesModified | length' "$RESULT_FILE")
if [ "$FILES_MODIFIED" -eq 0 ]; then
  echo "❌ No files modified — suspicious"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ filesModified: $FILES_MODIFIED file(s)"
fi

# 5. Verify output present
VERIFY_OUTPUT=$(jq -r '.verifyOutput // ""' "$RESULT_FILE")
if [ -z "$VERIFY_OUTPUT" ]; then
  echo "❌ verifyOutput is empty — must include command output"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ verifyOutput present"
fi

# 6. Stack compliance — no .js files in filesModified
for f in $(jq -r '.filesModified[]' "$RESULT_FILE"); do
  echo "$f" | grep -qE '\.js$' && echo "❌ .js file found: $f — must be .ts/.tsx" && ERRORS=$((ERRORS + 1))
done

# 7. Pipeline continuity — check previous bead's context-snapshot entry and Build Log row
# (Skip for the very first bead)
PREV_BEAD=$(jq -r '.previousBeadId // ""' "$RESULT_FILE")
if [ -n "$PREV_BEAD" ] && [ "$PREV_BEAD" != "null" ]; then
  echo ""
  echo "--- Pipeline Continuity Check (previous: $PREV_BEAD) ---"

  if [ -f "context-snapshot.md" ] && grep -q "$PREV_BEAD" context-snapshot.md; then
    echo "✅ Previous bead ($PREV_BEAD) has context-snapshot.md entry"
  else
    echo "❌ Previous bead ($PREV_BEAD) missing from context-snapshot.md"
    ERRORS=$((ERRORS + 1))
  fi

  if grep -q "$PREV_BEAD" CLAUDE.md 2>/dev/null; then
    echo "✅ Previous bead ($PREV_BEAD) has Build Log row in CLAUDE.md"
  else
    echo "❌ Previous bead ($PREV_BEAD) missing from CLAUDE.md Build Log"
    ERRORS=$((ERRORS + 1))
  fi
fi

echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "✅ All gates passed for $BEAD_ID — dispatch review-agent"
  exit 0
else
  echo "❌ $ERRORS gate(s) failed for $BEAD_ID — reject back to agent"
  exit 1
fi
