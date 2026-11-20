## 2026-11-20 — Hard rule 1 names CI's `verify`, the PR depth (Builder, #414)

**Context:** Hard rule 1 said `main` must "pass `npm run verify`", which is the full smoke. Since #372 / #411 CI's
`verify` gate runs the PR depth (unit + build, Lighthouse, one job per smoke shard) and the full smoke's deep checks
run nightly on production (`prod-smoke.yml`).
**Decision:** Rule 1 now reads: `main` passes CI's `verify` (the PR depth); the full smoke runs nightly, and a red
nightly opens `agent:prod-broken` at P1. The agent definitions say "`verify` (the PR depth)" instead of "full `verify`".
**Consequences:** A merge is gated on the PR depth only; a deep check that breaks shows up in the next nightly and is
fixed or reverted as a P1, not by running `npm run verify` before every push.
