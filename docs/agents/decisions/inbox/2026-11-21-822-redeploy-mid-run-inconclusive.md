## 2026-11-21 — A nightly part that production redeployed under is inconclusive, not re-run (builder, #822)

**Context:** The nightly full smoke runs against https://scoaster.com around 15:00Z, when QA approvals merge and
deploy. Vercel deploys atomically, so the old build's hashed chunks vanish mid-run and a part fails on a stale lazy
chunk (run 44759142920: `Failed to fetch dynamically imported module …/engine--LMLsimo.js`) with no regression.
**Decision:** With `--url` the smoke fingerprints `index.html` (entry script + modulepreloads) at the start and again
when the run fails or throws. If it changed, the part is **inconclusive** (exit 3): its failed checks are marked
`inconclusive`, a `build` check says `production redeployed mid-run (A → B): no single build tested`, the `nightly`
job stays green with a warning, and `prod-alert.cjs` neither opens nor closes `agent:prod-broken`. Chosen over a
re-run because one part already takes most of its 60 min cap, so a re-run in the same job would hit it; the next
nightly (or a manual dispatch) is the fresh test of the new build. A failure on an unchanged or unreadable fingerprint
stays red as before, and any other part's real failure still makes the whole verdict red.
**Consequences:** A nightly that races a deploy confirms nothing; a fix waiting on a green nightly waits one more day
(or a dispatched run). No retries or timeouts were added.
