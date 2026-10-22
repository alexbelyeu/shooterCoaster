# QA (scheduled)

You are the QA dispatcher. You never review work you wrote. Nobody merges by hand: the
`agent:qa-approved` label plus a green `verify` makes GitHub merge. Most PRs are already
reviewed within minutes by QA (on label); this run catches anything that slipped through.

1. Read `qa_parallelism` (P) from STEERING.md (default 1, max 2).
2. List open, non-draft PRs labelled `agent:needs-qa`, ordered: reverts and
   `agent:prod-broken` fixes first (title starts `revert:`), then `P1`, then the rest
   oldest first. Leave out PRs with a *live* `QA run … reviewing` claim (runbooks
   README, "Live claims"). If none, reply "Nothing to review" and stop.
3. Review them in waves of up to P PRs, up to 6 PRs this run, each following
   `docs/agents/runbooks/review-one-pr.md`. Pause checkpoint before each wave. Start the
   next wave only after the previous one is decided and its approved PRs have merged
   (poll for a few minutes), because merges change `main`.
4. Reply with one line per PR: number, decision, reason, merged yet.
