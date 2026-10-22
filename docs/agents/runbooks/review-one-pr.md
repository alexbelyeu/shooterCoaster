# Review one PR (used by `qa.md` and `qa-on-label.md`)

Every review has up to three independent reviewers, each in a fresh context: a
**playtest reviewer** (`.claude/agents/qa.md`: verify, screenshots, acceptance
criteria, hard rules) and, for larger code changes, the two reviewers from
`.claude/commands/wrap-pr.md` (`pr-correctness`, `pr-consistency`). You, the
dispatcher, make one decision from all of them and post it.

1. **Claim.** If the PR has a *live* `QA run … reviewing` claim (see "Live claims" in
   the runbooks README: under 2 hours old with no QA decision after it), skip it
   ("Already under review"). Otherwise comment `QA run <ISO timestamp> reviewing`, wait
   about 20 seconds, re-read the comments, and skip it if another live
   `QA run … reviewing` claim is earlier than yours.
2. **Light re-review?** If an earlier QA comment says the full review passed and only a
   merge conflict had to be fixed, and every commit since that reviewed head is a merge
   of `origin/main`, spawn only the playtest reviewer and tell it to do the light
   re-review in `qa.md`. Skip to step 5.
3. **Bundle.** Build the review bundle and fill in its Intent, per step 0 of
   `.claude/commands/wrap-pr.md`, unless the size gate there says to skip the two
   independent reviewers.
4. **Spawn in a single message**, in parallel:
   - Playtest reviewer: `subagent_type: "general-purpose"`, `model: "opus"`,
     `isolation: "worktree"`, `run_in_background: false`, prompt: "You are QA for
     ShooterCoaster. Your working directory is a git worktree of
     alexbelyeu/shootercoaster. Read `.claude/agents/qa.md` and follow it exactly.
     Review PR #<n> — <title>. You are part of a combined review: do not comment or
     change labels; end with your verdict and the comment text."
   - Unless skipped by the size gate: `pr-correctness` and `pr-consistency` with the
     branch name and bundle path, as step 1 of `wrap-pr.md` describes.
5. **Decide** (pause checkpoint first: if paused, post nothing and stop):
   - **Request changes** if the playtest reviewer requests changes, or either
     independent reviewer has a blocking finding (`wrap-pr.md` step 2). Post one
     comment: "QA: changes requested", the numbered required changes (file, what's
     wrong, what good looks like), then "Suggestions" for non-blocking items. Swap
     `agent:needs-qa` → `agent:changes-requested`. That label starts the Fix task.
   - **Approve** otherwise: post one comment, "QA: approved", with the playtest
     reviewer's 2–3 line summary, "Independent review: correctness ✓ consistency ✓"
     (or "skipped (small diff)"), and any non-blocking suggestions (file `P3` issues for
     the ones worth doing). Then swap `agent:needs-qa` → `agent:qa-approved`. GitHub
     merges once `verify` is green.
   - **Close** if it has been sent back 3 times already: close the PR, label its issue
     `agent:blocked`, and explain for the Director.
   - Say "merge conflict only; full review passed" in a change request whose only
     required change is resolving a conflict, so the next round can be light.
