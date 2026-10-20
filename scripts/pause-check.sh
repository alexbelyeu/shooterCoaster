#!/usr/bin/env bash
# Is the studio paused? Every agent runs this first, and again before long steps.
#
#   Paused  -> prints "PAUSED: ..." and exits 3. Stop: no new work, no labels.
#   Running -> prints "not paused" and exits 0.
#
# Alex pauses by opening an issue labelled `pause` (one tap from the link in
# PROTOCOL.md). Title "PAUSE" pauses until the issue is closed; "PAUSE until
# 2026-10-21 08:00" (New York time) resumes on its own: the first agent to run
# after that time closes the issue. `pause: true` in STEERING.md also pauses.
set -uo pipefail

REPO="${SC_REPO:-alexbelyeu/shooterCoaster}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if grep -Eq '^pause:[[:space:]]*true' "$ROOT/docs/agents/STEERING.md" 2>/dev/null; then
  echo "PAUSED: docs/agents/STEERING.md has pause: true"
  exit 3
fi

if ! issues=$(gh api "repos/$REPO/issues?state=open&labels=pause&per_page=20" \
  --jq '.[] | select(.pull_request == null) | "\(.number)\t\(.title)"' 2>&1); then
  # Can't tell. Fail closed: a pause Alex set must never be ignored.
  echo "PAUSED: could not check for pause issues ($issues)"
  exit 3
fi

now=$(date -u +%s)
while IFS=$'\t' read -r num title; do
  [ -z "$num" ] && continue
  until_txt=$(printf '%s' "$title" | sed -nE 's/.*[Uu]ntil[[:space:]]+([0-9]{4}-[0-9]{2}-[0-9]{2}([ T][0-9]{1,2}:[0-9]{2})?).*/\1/p')
  if [ -n "$until_txt" ]; then
    until_ts=$(TZ=America/New_York date -d "${until_txt/T/ }" +%s 2>/dev/null || echo "")
    if [ -n "$until_ts" ] && [ "$now" -ge "$until_ts" ]; then
      gh api -X POST "repos/$REPO/issues/$num/comments" \
        -f body="Pause window ended ($until_txt New York time). Resuming." >/dev/null 2>&1
      gh api -X PATCH "repos/$REPO/issues/$num" -f state=closed >/dev/null 2>&1
      continue
    fi
    echo "PAUSED: issue #$num \"$title\" (resumes after $until_txt New York time)"
    exit 3
  fi
  echo "PAUSED: issue #$num \"$title\" (until the issue is closed)"
  exit 3
done <<< "$issues"

echo "not paused"
exit 0
