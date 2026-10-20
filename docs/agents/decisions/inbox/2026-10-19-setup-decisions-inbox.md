## 2026-10-19 — Decisions inbox, folded nightly; light re-review after conflict-only bounces (setup)

**Context:** Almost every PR appended to `DECISIONS.md`, so whenever two PRs were open
the second to merge conflicted. Each conflict cost a full builder round (full verify)
plus a full QA review, adding 30–60 min of Opus time per PR.

**Decision:** New decisions are separate files in `docs/agents/decisions/inbox/`; the
Maintainer is the only writer of `DECISIONS.md` and folds the inbox nightly (archiving
past years to `decisions/<year>.md` past ~1500 lines). When QA bounces a PR only for a
merge conflict after a passing full review, the builder just merges `main` and runs
unit tests + build, and QA does a light re-review of the conflict resolution (full
verify only if `src/` or `e2e/` conflicted). CI `verify` still gates every merge.

**Consequences:** The main source of conflicts between parallel PRs is gone, and
conflict round trips take minutes instead of most of an hour. `CLAUDE.md` code-map
edits can still conflict occasionally; those go through the light path too.
