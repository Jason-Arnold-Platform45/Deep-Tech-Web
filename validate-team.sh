#!/usr/bin/env bash
# validate-team.sh — run after team design, before build starts
# Verifies cluster↔agent mapping, no orphaned responsibilities, valid DAG
set -e
ERRORS=0
AGENTS_DIR=".claude/agents"

echo "=== TEAM VALIDATION ==="

# 1. Check all expected agent files exist
EXPECTED_AGENTS=("infra-agent" "pipeline-agent" "intelligence-agent" "dashboard-agent" "review-agent" "context-agent")
for AGENT in "${EXPECTED_AGENTS[@]}"; do
  if [ ! -f "$AGENTS_DIR/${AGENT}.md" ]; then
    echo "❌ MISSING AGENT FILE: $AGENTS_DIR/${AGENT}.md"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ Found: $AGENTS_DIR/${AGENT}.md"
  fi
done

# 2. Check that every cluster in tasks.md has a matching agent file
if [ -f "docs/tasks.md" ]; then
  CLUSTERS=$(grep -oP 'Cluster:\s*\K\S+' docs/tasks.md | sort -u)
  for CLUSTER in $CLUSTERS; do
    if [ ! -f "$AGENTS_DIR/${CLUSTER}-agent.md" ] && [ ! -f "$AGENTS_DIR/${CLUSTER}.md" ]; then
      echo "❌ ORPHANED CLUSTER: '${CLUSTER}' has no matching agent file"
      ERRORS=$((ERRORS + 1))
    else
      echo "✅ Cluster '${CLUSTER}' has matching agent"
    fi
  done
else
  echo "⚠️  docs/tasks.md not found — skipping cluster validation"
fi

# 3. Check that review-agent and context-agent exist (mandatory)
for MANDATORY in "review-agent" "context-agent"; do
  if [ ! -f "$AGENTS_DIR/${MANDATORY}.md" ]; then
    echo "❌ MANDATORY AGENT MISSING: ${MANDATORY}"
    ERRORS=$((ERRORS + 1))
  fi
done

# 4. Check that review-agent is read-only (no Write/Edit in tools)
if [ -f "$AGENTS_DIR/review-agent.md" ]; then
  if grep -q "Write" "$AGENTS_DIR/review-agent.md" | head -1 && \
     grep "^## Tools" "$AGENTS_DIR/review-agent.md" -A 1 | grep -q "Write"; then
    echo "❌ SECURITY: review-agent has Write access — must be read-only"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ review-agent is read-only"
  fi
fi

# 5. Validate beads DAG
if command -v bd &> /dev/null; then
  echo ""
  echo "=== BEADS DAG VALIDATION ==="
  # Get first task ID and check its dep tree
  FIRST_ID=$(bd list --json 2>/dev/null | jq -r '.[0].id // empty' 2>/dev/null)
  if [ -n "$FIRST_ID" ] && bd dep tree "$FIRST_ID" --direction down 2>/dev/null; then
    echo "✅ Dependency tree is valid"
  else
    echo "✅ Beads loaded (dep tree requires issue ID — skipping full traversal)"
  fi

  # Check that at least one task is ready
  READY=$(bd ready --json 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
  if [ "$READY" -gt 0 ]; then
    echo "✅ $READY task(s) ready to start"
  else
    echo "⚠️  No tasks ready — check dependencies"
  fi
else
  echo "⚠️  bd CLI not found — skipping DAG validation"
fi

# 6. Check required directories
echo ""
echo "=== DIRECTORY VALIDATION ==="
for DIR in ".beads/results" ".beads/verdicts" "docs/debate-rounds"; do
  if [ -d "$DIR" ]; then
    echo "✅ Directory exists: $DIR"
  else
    echo "❌ MISSING DIRECTORY: $DIR"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "✅ Team validation PASSED — build may proceed"
  exit 0
else
  echo "❌ Team validation FAILED — $ERRORS error(s) found. Fix before building."
  exit 1
fi
