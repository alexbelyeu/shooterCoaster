# QA (on label)

A GitHub event started this run: a label was added to a pull request labelled `agent:needs-qa`. Review
**only that PR**, in this session: you are its playtest reviewer (`.claude/agents/qa.md`),
so don't spawn one. If no pull-request number came with this run (someone pressed Run
now), reply "No PR event — nothing to do" and stop.

0. **One run per review.** The trigger fires on *every* label added while `agent:needs-qa` is on
   (`P1`, `type:…` added in the same call start runs too: #398 got three reviews in a minute).
   If the event says which label was added (`label.name`) and it isn't `agent:needs-qa`, reply
   "Not the needs-qa label — nothing to do" and stop, before reading anything else.

1. Re-read the PR. Continue only if it is open, not a draft, its head branch starts with
   `agent/`, and it is labelled `agent:needs-qa`. Otherwise reply "Nothing to review" and
   stop.
2. Follow `docs/agents/runbooks/review-one-pr.md` for it.
3. Don't wait for the merge: the auto-merge workflow merges an approved PR once `verify` is
   green, and says so on the PR if it can't. Polling only re-reads your whole context.
4. `node scripts/run-usage.cjs --role qa-on-label --ref "#<n>" --post`, then reply with one
   line: PR number, decision, reason, `verify` state.
