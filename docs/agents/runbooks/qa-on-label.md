# QA (on label)

A GitHub event started this run: a pull request was labelled `agent:needs-qa`. Review
**only that PR**, in this session: you are its playtest reviewer (`.claude/agents/qa.md`),
so don't spawn one. If no pull-request number came with this run (someone pressed Run
now), reply "No PR event — nothing to do" and stop.

1. Re-read the PR. Continue only if it is open, not a draft, its head branch starts with
   `agent/`, and it is labelled `agent:needs-qa`. Otherwise reply "Nothing to review" and
   stop.
2. Follow `docs/agents/runbooks/review-one-pr.md` for it.
3. Don't wait for the merge: the auto-merge workflow merges an approved PR once `verify` is
   green, and says so on the PR if it can't. Polling only re-reads your whole context.
4. `node scripts/run-usage.cjs --role qa-on-label --ref "#<n>" --post`, then reply with one
   line: PR number, decision, reason, `verify` state.
