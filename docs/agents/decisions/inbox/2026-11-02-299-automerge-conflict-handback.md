## 2026-11-02 — Auto-merge hands conflicting approved PRs back to Fix (Builder, #299 / #241)

**Context:** When an approved PR conflicted with `main`, `scripts/automerge.cjs` commented
`Auto-merge failed:` and left `agent:qa-approved` on it. No role watches that label, so the
PR waited for the nightly Maintainer (#276 stalled twice this way).

**Decision:** A conflict is detected from the PR's `mergeable === false` (checked before
`verify`, since CI doesn't run on a conflicting PR) or a merge answered "not mergeable".
The workflow then comments a conflict-only change request ("merge conflict only; full
review passed") and swaps `agent:qa-approved` → `agent:changes-requested`, which starts Fix
(on label); QA follows with the light re-review. Other merge failures (for example "Base
branch was modified") keep the label and are retried by the sweep. Conflict hand-backs
don't count towards the 3 sends back: nothing was wrong with the change. Each PR in a run
is handled in its own `try/catch`, so one API error can't skip the CI dispatch on `main`
after an earlier merge.

**Consequences:** Conflicts cost one light Fix + QA round instead of a stall. A PR that
keeps conflicting can loop Fix ↔ auto-merge without hitting the bounce limit; each loop
needs `main` to move again, so it ends once the queue drains.
