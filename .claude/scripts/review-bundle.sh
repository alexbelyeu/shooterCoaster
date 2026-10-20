#!/usr/bin/env bash
# Builds the single file the independent PR reviewers (pr-correctness,
# pr-consistency) read, so each needs one `cat` instead of many tool round trips.
#
# Usage: .claude/scripts/review-bundle.sh [base-ref] [out-file]
#   base-ref defaults to origin/main; run it with the PR branch checked out.
set -euo pipefail

BASE="${1:-origin/main}"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

git rev-parse --verify --quiet "$BASE" >/dev/null || {
  echo "review-bundle: base ref '$BASE' not found" >&2
  exit 1
}

OUT="${2:-${TMPDIR:-/tmp}/review-bundle-${BRANCH//\//-}.md}"
EXCLUDES=(':!package-lock.json' ':!*.lock' ':!e2e-results' ':!*.png' ':!docs/reports')
mkdir -p "$(dirname "$OUT")"

changed=$(git diff "$BASE...HEAD" --name-only -- . "${EXCLUDES[@]}")
touches() { printf '%s\n' "$changed" | grep -Eq "$1"; }

{
  echo "# Review bundle: \`$BRANCH\` vs \`$BASE\`"
  echo
  echo "Read this file with \`cat\`. It is the primary input. Open source files only"
  echo "to trace a specific concern the diff cannot answer."
  echo
  echo "## Intent"
  echo
  echo "<!-- DISPATCHER: replace this block with 5-10 lines on what the PR is trying"
  echo "     to accomplish, from the PR description and its linked issue. -->"
  echo
  echo "## Commits"
  echo
  echo '```'
  git log "$BASE..HEAD" --oneline
  echo '```'
  echo
  echo "## Changed files"
  echo
  echo '```'
  git diff "$BASE...HEAD" --stat -- . "${EXCLUDES[@]}"
  echo '```'
  echo
  echo "## Conventions"
  echo
  echo "The standards this PR must meet."
  echo
  echo "### CLAUDE.md"
  echo
  cat CLAUDE.md
  echo
  if touches '^src/'; then
    echo "### docs/HEAP-BOTTLENECKS.md"
    echo
    cat docs/HEAP-BOTTLENECKS.md
    echo
  fi
  if touches '^src/(levels|entities|track)/'; then
    echo "### .claude/skills/shooter-coaster-level-design/SKILL.md"
    echo
    cat .claude/skills/shooter-coaster-level-design/SKILL.md
    echo
  fi
  echo "## Diff"
  echo
  echo "\`git diff $BASE...HEAD -U30\`, excluding lockfiles, screenshots and reports."
  echo
  echo '```diff'
  git diff "$BASE...HEAD" -U30 -- . "${EXCLUDES[@]}"
  echo '```'
} > "$OUT"

echo "$OUT"
wc -c < "$OUT" | awk '{printf "%d chars (~%d tokens)\n", $1, $1/4}'
