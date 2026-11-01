#!/usr/bin/env bash
# Run a noisy command without flooding the agent's context (CLAUDE.md "Context budget").
# The full output goes to a log file; you get one status line, and on failure the
# error/failure lines plus the tail. The exit code is the command's own.
#
#   bash scripts/quiet.sh npm run verify
#   bash scripts/quiet.sh node e2e/smoke.mjs --levels level1 --mobile
#
# Need more? grep -n / sed -n the log file it names. QUIET_TAIL (default 15 on success,
# 40 on failure) and QUIET_LOG_DIR (default /tmp/sc-logs) override the defaults.
set -u
dir="${QUIET_LOG_DIR:-/tmp/sc-logs}"
mkdir -p "$dir"
name="$(printf '%s' "$*" | tr -c 'A-Za-z0-9._-' '_' | cut -c1-60)"
log="$dir/$(date +%H%M%S)-$$-$name.log"
"$@" >"$log" 2>&1
code=$?
echo "── $* → exit $code · $(wc -l <"$log" | tr -d ' ') lines · full log: $log"
if [ "$code" -ne 0 ]; then
  echo "── error / failure lines (first 60):"
  grep -n -i -E '(error|fail|✗|✘|×|exception|assert|over budget|timed? ?out|stalled)' "$log" |
    grep -v -i -E '(^|[^0-9])0 (errors?|failed|failures?)|errors?[=:] ?0([^0-9]|$)' | head -n 60
  echo "── last ${QUIET_TAIL:-40} lines:"
  tail -n "${QUIET_TAIL:-40}" "$log"
else
  tail -n "${QUIET_TAIL:-15}" "$log"
fi
exit "$code"
