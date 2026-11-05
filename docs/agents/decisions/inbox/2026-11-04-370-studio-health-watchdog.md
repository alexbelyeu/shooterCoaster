## 2026-11-04 — Studio-health watchdog: a plain Action that files the studio's own problems (builder, #370)

**Context:** Every flake, timeout and stuck PR in the week of 2 Nov was found by Alex reading GitHub
emails. Agents waved red checks through as "known flakes", and nothing noticed when scheduled runs
stopped.

**Decision:** `.github/workflows/studio-health.yml` runs `scripts/studio-health.cjs` every 2 h as a
plain Action, not an agent task, so it still runs when the agents are what's broken. Pure rules in
`scripts/studioHealthRules.cjs` keep one `studio-health` issue per problem (body marker), `agent:ready`
+ P1, ahead of feature work. Thresholds: runtime creep at a median of ≥ 75 % of a job's limit over ≥ 3
green runs; stalled when ≥ 2 scheduled Builders / QA slots (studio-status.cjs `SCHEDULE`, 2 h grace
each) with work queued for that role pass without a token-ledger post; approved PRs unmerged 3 h after
the label, `needs-qa` waiting 24 h; escalation to Alex once, when open 24 h and still seen in the last
24 h. It never duplicates the existing alerts: red `main` in ci.yml's `verify` and every prod-smoke
failure already open `agent:prod-broken` (revert first, PROTOCOL "When main breaks"), so the watchdog
only escalates those in place after 12 h. Runs older than a key's last close don't count, so closing an
issue after its fix sticks. PROTOCOL "No known flakes": a check failing without the change causing it is
a P1 bug in the check; QA never approves past it.

**Consequences:** Builders and the Maintainer spend runs on CI health before features. Findings about
the current state (stalled, stuck PRs, QA backlog) refile while the state holds even if closed by hand.
Workflow limits are read from main, so a job that ran well past one (an unmerged PR on an older
workflow file) is ignored for timeouts and creep.
