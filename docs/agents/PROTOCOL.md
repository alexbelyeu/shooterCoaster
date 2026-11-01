# Agent protocol

How the autonomous ShooterCoaster studio works. Every scheduled session reads this.

## The loop

| Role | Model | When (America/New_York) | Job |
|---|---|---|---|
| **Marketer** | Fable (latest) | Mon ~05:15 | Measures the game (Vercel Web Analytics), keeps `docs/marketing/`, files growth issues, drafts posts and ad campaigns for Alex to place |
| **Reporter** | Sonnet | Mon ~06:15 | Writes last week's report, emails Alex |
| **Director** | Fable (latest) | Mon ~07:45 | Reads report + steering, updates vision/state, plans the week as issues |
| **Builders** | Opus | daily ~08:45, ~13:45, ~18:45 | Each run: up to N parallel builder subagents, one issue each → PRs |
| **QA** | Opus | daily ~10:15, ~15:15, ~20:15 (~90 min after each builder run) | Independent review + playtest of open PRs; approves or requests changes |
| **QA (on label)** | Opus | when a PR gets `agent:needs-qa` | Reviews just that PR |
| **Fix (on label)** | Opus | when a PR gets `agent:changes-requested` | One builder fixes just that PR |
| **Maintainer** | Opus | daily ~03:35 | Keeps `main` healthy: prod-broken issues, reverts, stale claims, tech debt |

Each scheduled task's prompt is a short bootstrap that runs `scripts/pause-check.sh`
and then follows its runbook in `docs/agents/runbooks/` (see the README there), so
changing how a role works is an ordinary reviewed PR. Role definitions live in
`.claude/agents/<role>.md`. Each scheduled task runs on its role's model. Director, Maintainer and Reporter sessions carry out their role
directly. The scheduled Builders and QA sessions are thin **dispatchers**: they pick the
work, then spawn Opus subagents in parallel with `isolation: "worktree"` (so they never
share a working tree), each told to follow `.claude/agents/builder.md` or `qa.md`. The
on-label tasks handle one PR and carry out `builder.md` / `qa.md` themselves, so the
bootstrap isn't paid twice. Every run ends by logging its token use to the
`token-ledger` issue (`scripts/run-usage.cjs`).

**Sound designer.** `type:audio` issues go to the Sound designer
(`.claude/agents/sound-designer.md`) instead of a plain builder. It is a role, not a
scheduled task: the Builders dispatcher and Fix (on label) hand it audio work. It follows
`builder.md` for process and adds composing, rendering and measuring sound
(`docs/audio/SOUND-BIBLE.md`). No agent can hear, so audio PRs commit short renders to
`docs/audio/renders/` for Alex. The first new theme for each level waits for his pick in a
`needs-alex` `Listen:` issue; the issue that wires it in stays `agent:blocked` with
`Waiting on #<n>` until the Maintainer sees the listening issue closed.

Throughput is tuned with the knobs in STEERING.md (`builder_parallelism`,
`qa_parallelism`), not by changing schedules. Max plan budget: 15 scheduled runs per
day per account; this loop uses ~7 (9 on Mondays).

**Pausing.** Any open issue labelled `pause` stops the whole studio; so does
`pause: true` in STEERING.md. Alex opens one with one tap from the link at the bottom
of the status page. Title `PAUSE` holds until the issue is closed; `PAUSE until
2026-10-21 08:00` (New York time) resumes by itself: the first agent to run after that
time closes the issue. Every run checks `scripts/pause-check.sh` first and again before
each wave of subagents and long step (`npm run verify`, pushing, deciding). When paused,
an agent starts nothing new, leaves claims and labels as they are (a builder pushes its
work as a draft PR), and ends with the PAUSED line. A session already in the middle of a
long step finishes that step first; to stop it immediately, archive the session in the
Claude app. Approved PRs still auto-merge while paused, since that costs no Claude usage.
If the check itself fails, agents treat it as paused.

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
| `docs/agents/DECISIONS.md` | Maintainer (folds the inbox nightly) | Architecture/design decisions with reasons. Read the inbox too for the latest. |
| `docs/agents/decisions/inbox/` | Anyone, one new file per decision | Where every new decision entry goes. Never edit `DECISIONS.md` directly. |
| `docs/reports/` | Reporter | Weekly reports |
| GitHub Issues | Director creates, builders consume | The work queue |
| `budgets.json` | Director | CI-enforced budgets |

## Labels

- Queue: `agent:ready` → `agent:in-progress` → (PR) `agent:needs-qa` → `agent:qa-approved` (auto-merged by GitHub when `verify` is green), or `agent:changes-requested` → back to the builder.
- `agent:blocked` — can't proceed; the comment says why. Director re-plans it.
- `agent:prod-broken` — production smoke test failed (opened by the nightly workflow). Maintainer drops everything for it.
- `steering` — an issue from Alex. Director treats it like STEERING.md.
- Priority: `P1` (this week, do first), `P2` (this week), `P3` (if time).
- Type: `type:feature`, `type:level`, `type:content`, `type:polish`, `type:perf`, `type:tech`, `type:bug`, `type:audio`, `type:growth`.
- `epic` — umbrella issue the Director breaks into `agent:ready` children. Never claimed by builders.
- `studio-status` — the live status page issue (see above). Not work; never touch it.
- `token-ledger` — the "🧮 Token ledger" issue: one comment per run from `scripts/run-usage.cjs` (runbooks README, "Token ledger"). Not work: agents only append comments; builders ignore it; nobody edits or closes it.
- `needs-alex` + `type:audio`, titled `Listen: …` — renders waiting for Alex's ear; he closes it with his pick. Builders never claim it.
- `marketing` + `needs-alex` — a draft post or campaign from the Marketer that only Alex can carry out (agents never post, spend or create accounts). Builders ignore these. `type:growth` — discoverability or growth work for builders, filed by the Marketer.
- Add `agent:needs-qa` / `agent:changes-requested` **last, in a call of their own**, after any other labels. Each label added while one of those is present fires the on-label task again, so adding three labels at once starts three sessions. When swapping (e.g. `agent:needs-qa` → `agent:changes-requested`), remove the old label first, then add the new one in a separate call.

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
  Exceptions, where CI's `verify` is the check: the Director's and the Reporter's docs-only
  PRs (the `verify` they ran on `main` while gathering covers them) and a returned PR whose
  only change is a merge of `origin/main` that didn't touch `src/` or `e2e/` (`npm test &&
  npm run build` is enough; `builder.md` step 1).

## Merging — agents approve, GitHub merges

**No agent ever merges a PR.** Approval is the `agent:qa-approved` label; the
`Auto-merge approved PRs` workflow (`.github/workflows/automerge.yml`, logic in
`scripts/automerge.cjs`) squash-merges an approved PR once the `verify` check is green on
its head commit. It runs on the PR's label events, after every CI run, and as a sweep of
every open approved PR every 10 minutes, so an approved PR with a green `verify` merges
within about 10 minutes even if an event was missed. When it can't merge an approved PR
for any reason but `verify` still running (red `verify`, conflict, draft…), it says so
once per head in a PR comment starting `Auto-merge skipped:` or `Auto-merge failed:`.
Pushing new commits to an approved PR removes the label automatically.

QA applies `agent:qa-approved` only when **all** hold:
1. GitHub check `verify` is `success` (or still running) on the PR's head SHA (`gh api repos/alexbelyeu/shootercoaster/commits/<sha>/check-runs`).
2. QA playtested the branch as `.claude/agents/qa.md` says (a green CI `verify` stands
   for the full run; QA builds and smokes the levels the diff affects and looks at those
   screenshots, or runs the full `npm run verify` when CI is red or missing), or, when the
   PR came back only to resolve a merge conflict after a passing full review, did the light
   re-review there.
3. The acceptance criteria are met and CLAUDE.md hard rules are respected.
4. It still works on top of current `main`: if files changed on `main` since the branch
   point overlap the PR's files (`git diff --name-only`, see `qa.md`), merge `origin/main`
   into it **locally** and test the result; otherwise CI (which ran on the PR merged with
   `main`) and the production smoke after the merge cover it. QA doesn't need to push — GitHub
   merges approved PRs that are behind `main` as long as there are no conflicts. Only a
   real conflict sends the PR back to its author (`agent:changes-requested`).

**There is no self-approval.** Every PR — features, docs-only, reports, reverts —
needs the `agent:qa-approved` label from a QA run that did not write it. The platform
enforces this: an agent's attempt to approve its own PR is blocked. Open your PR with
`agent:needs-qa` and move on; do not wait for it to merge.

**Event-driven review loop.** Two more scheduled tasks start on GitHub label events, not
on a clock: **QA (on label)** runs whenever a PR on an `agent/*` branch gets
`agent:needs-qa`, and **Fix (on label)** runs whenever one gets
`agent:changes-requested`. Each handles only that one PR (as its reviewer or its
builder, in the same session) and stops. So a sent-back PR is fixed and re-reviewed within the hour, until
it merges or QA closes it after 3 rounds. Every QA session comments
`QA run <time> reviewing` before it starts, and every builder session comments
`Builder run <time> is on it`. Any session seeing such a claim that is still *live* (under 2
hours old, with no decision or builder reply posted after it) leaves that PR alone; a
claim from a finished round doesn't count. The scheduled Builders runs start new
issues; the scheduled QA runs catch anything the events missed.

**Independent code review.** Besides the playtest reviewer, every PR whose code diff is
~300 lines or more gets, on its first review, two fresh-context reviewers in parallel
(a re-review after a fix runs them only when the fix itself is ~300 lines or more): `pr-correctness` (bugs,
leaks, frame-rate and lifetime problems) and `pr-consistency` (right approach, reuse of
existing systems, conventions), both reading one review bundle
(`.claude/scripts/review-bundle.sh`). The QA session combines the three into one
decision (`docs/agents/runbooks/review-one-pr.md`, `.claude/commands/wrap-pr.md`).
Builders run `.claude/commands/deslop.md` over their files before shipping.

QA reviews in this order: (1) revert / `agent:prod-broken` fixes, (2) P1, (3) the rest
oldest first.

If the workflow comments that the merge failed (usually a conflict), merge `origin/main`
into the branch, resolve the conflicts, re-verify, and push normally — then QA
re-approves.

**Updating a pushed branch:** always `git merge origin/main` and push normally. Never
rebase a branch that is already on GitHub — that needs a force-push, which hard rule 2
forbids.

## When main breaks

Revert first, investigate second. Open a PR that `git revert`s the offending merge
commit, verify, and label it `agent:needs-qa` + `P1` with a title starting `revert:` —
QA reviews reverts first — then reopen the original issue with what went wrong.

## Environment facts (Claude cloud sessions)

- Network is allowlisted: npm, pip and GitHub work; arbitrary websites (including the Vercel deployments and the Playwright CDN) do not. Don't retry blocked hosts with other tools.
- Headless Chromium: `export SC_CHROME="$(scripts/ensure-browser.sh)"`. Rendering is software (SwiftShader), so **frame times are much slower than real hardware** — use them only for relative comparisons; draw calls and triangle counts are reliable.
- GitHub through `gh api` (REST only). GraphQL, repository-settings writes, branch deletion and GitHub Actions API paths are blocked by the proxy. `gh pr create` may work; if not, use `gh api -X POST repos/alexbelyeu/shootercoaster/pulls`.
- CI `verify` runs on every PR and on `main` after every auto-merge (`automerge.yml` dispatches `ci.yml`, since `GITHUB_TOKEN` pushes don't trigger `push`); read it with `gh api repos/alexbelyeu/shootercoaster/commits/main/check-runs?check_name=verify`. A red `main` run opens or comments on the `agent:prod-broken` issue.
- You cannot read CI logs through the API. Reproduce failures locally with `npm run verify`.
- **Keep logs out of the conversation.** Redirect long output to a file and print only a
  summary: `npm run verify > /tmp/verify.log 2>&1; grep -E '^(PASS|FAIL)|Tests |error' /tmp/verify.log; tail -n 40 /tmp/verify.log`.
  Never dump full logs, `results.json` (query it with `node -e` / `jq`) or long diffs
  into the conversation; every line you print is re-read on every later turn.
- No image, model or audio generation tools. Visuals come from code: procedural geometry, shaders, instancing, post-processing. Audio is synthesised in code: Tone.js today, and the Scrimshaw-based engine replacing it (`docs/audio/`). You can't hear audio, but you can render it offline in headless Chromium and measure it (ffmpeg `ebur128`, spectrogram PNGs you read with the Read tool): see `docs/audio/reference/README.md`.

## Commits

End each commit message with the attribution lines your session's instructions give you.
