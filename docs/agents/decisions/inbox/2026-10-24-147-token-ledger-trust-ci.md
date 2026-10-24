## 2026-10-24 — Token ledger per run; QA trusts CI verify (interactive session for Alex, #147)

**Context:** Weekly Claude usage hit 40% in two days. Nothing measured tokens per run, and the
same full `npm run verify` ran several times per PR (CI, builder iterations, QA, QA again
after merging `main`), while on-label tasks bootstrapped twice (session + one subagent).
**Decision:** Every run logs its token use with `scripts/run-usage.cjs --post` to the
`token-ledger` issue; the status page and weekly report sum it. A green CI `verify` on the PR
head is QA's pass/fail: QA builds and smokes only the affected levels, and re-tests on top of
`main` only when `main`'s changes since the branch point overlap the PR's files. On-label
QA/Fix work in the main session. Independent reviewers re-run on a fix only if the fix is
≥~300 lines. Builders run the full verify once, before review.
**Consequences:** Semantic conflicts between a PR and unrelated `main` changes can reach
`main` and are caught by the post-merge production smoke (revert first). Don't restore the
repeated full verifies without checking the ledger for what they cost.
