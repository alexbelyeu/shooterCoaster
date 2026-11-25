## 2026-11-25 — Only a red deploy check deploys every merge at once (Alex, #1016)

**Context:** #1015 deployed every green `main` while any `agent:prod-broken` issue was open. The nightly's (#707) and a
red `main`'s (#991) were open for days, so merges went back to deploying one by one.
**Decision:** Only the deploy check's own alert (`prod-alert.cjs` marker `deploy`: the live site is broken) skips the
daily batch. A red nightly or a red `main` waits for the 05:00 UTC deploy, which runs an hour before the nightly.
**Consequences:** A fix for a nightly-only failure is live, and confirmed, the next morning; start Deploy to ship it sooner.
