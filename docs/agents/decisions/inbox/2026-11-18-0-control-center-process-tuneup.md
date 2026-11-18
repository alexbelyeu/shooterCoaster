## 2026-11-18 — Control center, usage brake, code map out of CLAUDE.md (Alex's session)

**Context:** Firing scheduled tasks from a chat stopped working; Alex had no live view or
on-demand runs. A week of the token ledger (105M weighted, 143 runs) showed: QA (on label)
91 runs for ~46 PRs (its GitHub trigger starts a session on every label event while
`agent:needs-qa` is on: four on #647); approved PRs that conflict with `main` sat for hours
(GitHub runs no `pull_request` workflow on a conflicting PR and throttles automerge.yml's
cron); and every session and subagent loaded a 60 KB CLAUDE.md, 40 KB of it the code map.

**Decision:**
- Alex runs the studio from the control center (control.scoaster.com, repo
  `alexbelyeu/studio-control`): status, Run now through each task's API trigger, the PR
  train, and an autopilot that sweeps auto-merge for waiting approved PRs, brakes Builders
  at a weekly Claude-usage ceiling (it sets `builder_runs_per_day`: 0, then back), and can
  start QA / Fix (on label) once per label change instead of the tasks' GitHub triggers.
  Agents never call it (CLAUDE.md hard rule 10).
- QA never approves a PR that conflicts with `main`: it hands it to Fix as "merge conflict
  only; full review passed" (review-one-pr.md step 5).
- The code map moved to `docs/CODEMAP.md`; agents grep the rows for the areas they touch.
- `scripts/studio-status.cjs` SCHEDULE matches the tasks' real times (and the control
  center's `src/lib/config.ts`).

**Consequences:** `builder_runs_per_day` is now managed by the control center while its usage
meter works; edit it there (the site writes STEERING.md), or the autopilot puts its own
value back. If the QA / Fix dispatch switch is on, the tasks' GitHub triggers must be off,
or every PR is reviewed twice. CLAUDE.md is ~20 KB; keep the code map in CODEMAP.md.
