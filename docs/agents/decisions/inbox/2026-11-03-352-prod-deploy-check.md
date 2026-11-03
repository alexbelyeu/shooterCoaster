## 2026-11-03 — Production: a deploy health check, the full smoke nightly, alerts on transitions (Builder, #352)

**Context:** The post-deploy production run replayed the whole smoke against scoaster.com. Its runtime crept past its cap
(1465 → 1932 s), so every deploy "failed" with no failed check and emailed Alex through #297.
**Decision:** After a deploy, `e2e/prod-check.mjs` checks only that the deploy arrived intact (every built file served with
its headers, routes, title, one level to a kill, a phone run; ~3 min, 8 min cap). The full smoke runs against prod nightly
(60 min cap). Both run under `timeout`, so a slow run is a reported timeout, and a deploy run superseded by a newer deploy
is cancelled and says nothing. `scripts/prod-alert.cjs` keeps one `agent:prod-broken` issue per suite and uses it as the
state: it opens on green → red, stays silent while open and closes on the next green run. Choices that look arbitrary:
- The deploy check's kills go through `killNearest` (the bullet pool's hit path). Whether a tapped bullet lands depends on
  the software frame rate, and the nightly smoke and `verify` already gate touch aim assist.
- The deploy job uses the runner image's Chrome (`SC_CHROME=/usr/bin/google-chrome`), so there's no Playwright download.
- The files to expect come from a local `VERCEL=1` build of the deployed commit, matched to the deployed files by name
  without the hash, because Vercel's hashes can differ.
- CI's red-`main` report never comments on a production suite's issue, because that issue closes itself when prod goes green.
**Consequences:** A green → red change sends one email per outage. A timeout says "no check failed". The full suite still
catches CDN / runtime drift within a day. Don't move the full smoke back onto `deployment_status`, and don't just raise the cap.
