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
EXCLUDES=(':!package-lock.json' ':!*.lock' ':!e2e-results' ':!*.png' ':!*.webp' ':!*.mp3' ':!docs/reports')
# Prose and data the reviewers judge by name, not line by line: CLAUDE.md / CODEMAP.md rows are
# one very long line each, so 30 lines of context around an edited row was 30-40 KB per PR.
DOCS=(':(glob)**/*.md' 'docs/audio/renders')
mkdir -p "$(dirname "$OUT")"

changed=$(git diff "$BASE...HEAD" --name-only -- . "${EXCLUDES[@]}")
touches() { printf '%s\n' "$changed" | grep -Eq "$1"; }
CODE=(. "${EXCLUDES[@]}" ':!*.md' ':!docs/audio/renders')

{
  echo "# Review bundle: \`$BRANCH\` vs \`$BASE\`"
  echo
  echo "Read this file with \`cat\`. It is the primary input. Open source files only"
  echo "to trace a specific concern the diff cannot answer. CLAUDE.md is already in"
  echo "your context: it is not repeated here."
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
  if [ -n "$(git diff "$BASE...HEAD" --name-only -- "${DOCS[@]}")" ]; then
    echo "Docs and render data are listed above but not diffed below. To read one:"
    echo "\`git diff $BASE...HEAD -U3 -- <file>\` (for CLAUDE.md or docs/CODEMAP.md, add \`--word-diff\`)."
    echo
  fi
  echo "## Conventions"
  echo
  echo "- CLAUDE.md (in your context): hard rules, commands, context budget."
  if touches '^src/'; then
    echo "- docs/HEAP-BOTTLENECKS.md, below: per-frame allocation and disposal rules."
  fi
  if touches '^src/(levels|entities|track)/'; then
    echo "- \`.claude/skills/shooter-coaster-level-design/SKILL.md\`: the level, enemy and track rules."
    echo "  Read it (grep it for the system you are checking) when a finding depends on them."
  fi
  echo
  if touches '^src/'; then
    echo "### docs/HEAP-BOTTLENECKS.md"
    echo
    cat docs/HEAP-BOTTLENECKS.md
    echo
  fi
  echo "## Diff"
  echo
  echo "\`git diff $BASE...HEAD -U10\`, code only (no docs, lockfiles, images or render data)."
  echo
  echo '```diff'
  git diff "$BASE...HEAD" -U10 -- "${CODE[@]}"
  echo '```'
} > "$OUT"

echo "$OUT"
wc -c < "$OUT" | awk '{printf "%d chars (~%d tokens)\n", $1, $1/4}'
