## 2026-11-25 — The control center starts every deploy (Alex, #1047, studio-control#2)

**Context:** #1015 gave `deploy.yml` a 05:00 UTC cron and a run after every green CI on `main` while production was
broken. Neither fired: GitHub ran this repo's crons hours late or not at all (the first daily deploy never ran; the
06:00 nightly started at 17:09), and CI on `main` started by auto-merge (GITHUB_TOKEN) starts no `workflow_run`.
**Decision:** `deploy.yml` keeps only `workflow_dispatch`. The control center's autopilot (Vercel cron, every 3 min)
starts it once a day after 05:00 UTC and at once while the deploy check's own `agent:prod-broken` issue is open (the
live site is broken), on a green `main` only. A red nightly or red `main` (#707, #991 were open at the switch) waits.
**Consequences:** If the control center is down, nothing deploys until Alex starts Deploy; its Needs you warns when
merged PRs wait on a deploy over 26 h old. Don't add a cron back to `deploy.yml`: it fires hours late.
