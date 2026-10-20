# Agent protocol

How the autonomous ShooterCoaster studio works. Every scheduled session reads this.

## The loop

| Role | Model | When (America/New_York) | Job |
|---|---|---|---|
| **Reporter** | Sonnet | Mon ~06:15 | Writes last week's report, emails Alex |
| **Director** | Fable (latest) | Mon ~07:45 | Reads report + steering, updates vision/state, plans the week as issues |
| **Builders** | Opus | daily ~08:45, ~13:45, ~18:45 | Each run: up to N parallel builder subagents, one issue each → PRs |
| **QA** | Opus | daily ~10:15, ~15:15, ~20:15 (~90 min after each builder run) | Independent review + playtest of open PRs; approves or requests changes |
| **Maintainer** | Opus | daily ~03:35 | Keeps `main` healthy: prod-broken issues, reverts, stale claims, tech debt |

Role definitions live in `.claude/agents/<role>.md`. Each scheduled task runs on
its role's model. Director, Maintainer and Reporter sessions carry out their role
directly. Builder and QA sessions are thin **dispatchers**: they pick the work, then
spawn Opus subagents in parallel with `isolation: "worktree"` (so they never share a
working tree), each told to follow `.claude/agents/builder.md` or `qa.md`.

Throughput is tuned with the knobs in STEERING.md (`builder_parallelism`,
`qa_parallelism`), not by changing schedules. Max plan budget: 15 scheduled runs per
day per account; this loop uses ~7 (9 on Mondays).

**Studio status page.** The open issue labelled `studio-status` ("📊 Studio status
(live)") is Alex's live view of the studio. `.github/workflows/studio-status.yml`
rewrites its body from `scripts/studio-status.cjs` on every issue/PR/label change and
every 15 minutes. Agents never edit, comment on or close it, and never claim it. If a
role's schedule changes, update `SCHEDULE` in that script (and the table above) in
the same PR. Keep claim comments in the `Claimed by …` form, since the page reads them.

## Source of truth

| File | Owner | Purpose |
|---|---|---|
| `docs/agents/STEERING.md` | **Alex** | Direction from Alex. Overrides everything except CLAUDE.md hard rules. Agents never edit it, except the Director may tick items as done. |
| `docs/agents/VISION.md` | Director | What the finished game is, the quality bar, the roadmap |
| `docs/agents/STATE.md` | Director (weekly), Maintainer (fixes) | Honest snapshot of what exists, what's broken, what's half-done |
| `docs/agents/DECISIONS.md` | Anyone, append-only | Architecture/design decisions with reasons |
| `docs/reports/` | Reporter | Weekly reports |
| GitHub Issues | Director creates, builders consume | The work queue |
| `budgets.json` | Director | CI-enforced budgets |

## Labels

- Queue: `agent:ready` → `agent:in-progress` → (PR) `agent:needs-qa` → `agent:qa-approved` (auto-merged by GitHub when `verify` is green), or `agent:changes-requested` → back to the builder.
- `agent:blocked` — can't proceed; the comment says why. Director re-plans it.
- `agent:prod-broken` — production smoke test failed (opened by the nightly workflow). Maintainer drops everything for it.
- `steering` — an issue from Alex. Director treats it like STEERING.md.
- Priority: `P1` (this week, do first), `P2` (this week), `P3` (if time).
- Type: `type:feature`, `type:level`, `type:content`, `type:polish`, `type:perf`, `type:tech`, `type:bug`, `type:audio`.
- `epic` — umbrella issue the Director breaks into `agent:ready` children. Never claimed by builders.
- `studio-status` — the live status page issue (see above). Not work; never touch it.

## Issue contract (Director writes these)

Every `agent:ready` issue must be completable by one builder in one session and has:
**Goal** (player-facing why), **Scope** (files/systems likely touched), **Acceptance
criteria** (checkable, including what the smoke-test screenshot should show),
**Out of scope**, and **Notes** (relevant skills, decisions, pitfalls).

## Claiming work (Builders)

1. First: your own open PRs labelled `agent:changes-requested` (oldest first). Fix and push to the same branch.
2. Otherwise: the highest-priority `agent:ready` issue (P1 > P2 > P3, then oldest), skipping `epic`.
3. Claim it immediately: swap `agent:ready` → `agent:in-progress` and comment `Claimed by builder run <date time>`. When dispatching several builders, the dispatcher claims all issues **before** spawning them so two builders never take the same one.
4. Branch: `agent/<issue-number>-<short-slug>`. One issue per PR.

## Pull requests

- Title: conventional style (`feat(level6): …`, `fix(combat): …`, `perf(terrain): …`).
- Body: `Closes #<n>`, what changed and why, **how you verified it** (paste the smoke-test summary lines), screenshots attached or described, risks, follow-ups.
- Label `agent:needs-qa`. Builders never merge their own PRs.
- Before opening: `npm run verify` passes locally, you **looked at** the relevant screenshots, CLAUDE.md/docs updated if behaviour or structure changed.

## Merging — agents approve, GitHub merges

**No agent ever merges a PR.** Approval is the `agent:qa-approved` label; the
`Auto-merge approved PRs` workflow (`.github/workflows/automerge.yml`) squash-merges
an approved PR once the `verify` check is green on its head commit. Pushing new
commits to an approved PR removes the label automatically.

QA applies `agent:qa-approved` only when **all** hold:
1. GitHub check `verify` is `success` (or still running) on the PR's head SHA (`gh api repos/alexbelyeu/shootercoaster/commits/<sha>/check-runs`).
2. QA re-ran `npm run verify` on the branch itself and looked at the screenshots.
3. The acceptance criteria are met and CLAUDE.md hard rules are respected.
4. The branch is up to date with `main` (rebase it if not, re-verify).

Self-approval is allowed only for: the Director's and Reporter's PRs that touch nothing
but `docs/` and `budgets.json`, and the Maintainer's or QA's pure `git revert` PRs.
Everything else needs QA.

If the workflow comments that the merge failed (usually a conflict), rebase the
branch onto `main`, re-verify, push — then QA re-approves.

## When main breaks

Revert first, investigate second. Open a PR that `git revert`s the offending merge
commit, verify, and label it `agent:qa-approved` (allowed for pure reverts) so it
merges as soon as `verify` is green, then reopen the original issue with what went wrong.

## Environment facts (Claude cloud sessions)

- Network is allowlisted: npm, pip and GitHub work; arbitrary websites (including the Vercel deployments and the Playwright CDN) do not. Don't retry blocked hosts with other tools.
- Headless Chromium: `export SC_CHROME="$(scripts/ensure-browser.sh)"`. Rendering is software (SwiftShader), so **frame times are much slower than real hardware** — use them only for relative comparisons; draw calls and triangle counts are reliable.
- GitHub through `gh api` (REST only). GraphQL, repository-settings writes, branch deletion and GitHub Actions API paths are blocked by the proxy. `gh pr create` may work; if not, use `gh api -X POST repos/alexbelyeu/shootercoaster/pulls`.
- You cannot read CI logs through the API. Reproduce failures locally with `npm run verify`.
- No image, model or audio generation tools. Visuals come from code: procedural geometry, shaders, instancing, post-processing. Audio comes from Tone.js synthesis.

## Commits

End each commit message with the attribution lines your session's instructions give you.
