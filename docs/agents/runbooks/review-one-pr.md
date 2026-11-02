# Review one PR (used by `qa.md` and `qa-on-label.md`)

Every review has up to three independent reviewers, none of whom wrote the PR: a
**playtest reviewer** (`.claude/agents/qa.md`: verify, screenshots, acceptance
criteria, hard rules) and, for larger code changes, the two fresh-context reviewers from
`.claude/commands/wrap-pr.md` (`pr-correctness`, `pr-consistency`). You make one
decision from all of them and post it. In a QA (on label) run you are the playtest
reviewer yourself; the scheduled QA dispatcher spawns one per PR instead.

1. **Claim.** If the PR has a *live* `QA run … reviewing` claim (see "Live claims" in
   the runbooks README: under 2 hours old with no QA decision after it), skip it
   ("Already under review"). Otherwise comment `QA run <ISO timestamp> reviewing`, wait
   about 20 seconds, re-read the comments, and skip it if another live
   `QA run … reviewing` claim is earlier than yours.
2. **Light re-review?** If an earlier QA comment says the full review passed and only a
   merge conflict had to be fixed, and every commit since that reviewed head is a merge
   of `origin/main`, do only the light re-review in `qa.md`. In a QA (on label) run you
   do it yourself; the scheduled QA dispatcher spawns the playtest reviewer for it, as in
   step 4. Skip to step 5.
3. **Bundle.** Build the review bundle and fill in its Intent, per step 0 of
   `.claude/commands/wrap-pr.md`, unless the size gate there says to skip the two
   independent reviewers.
4. **Review.** Unless the size gate skipped them, spawn `pr-correctness` and
   `pr-consistency` in one message with the branch name and bundle path, as step 1 of
   `wrap-pr.md` describes. Then the playtest review:
   - QA (on label): start the two with `run_in_background: true`. They read this
     checkout, so leave it on the PR branch and playtest in a worktree of your own:
     `git worktree add --detach ../qa-<n> pr-<n>`, then work in `../qa-<n>` (detached,
     since `pr-<n>` is checked out here). `qa.md`'s local merge of `origin/main` and any
     `git checkout --detach origin/main` comparison happen there. Follow
     `.claude/agents/qa.md` yourself for this PR as a combined review (no comment or
     label changes before step 5), collect their findings, then
     `git worktree remove --force ../qa-<n>`.
   - Scheduled QA dispatcher: spawn the playtest reviewer in that same message:
     `subagent_type: "general-purpose"`, `model: "opus"`, `isolation: "worktree"`,
     `run_in_background: false`, prompt: "You are QA for ShooterCoaster. Your working
     directory is a git worktree of alexbelyeu/shootercoaster. Read
     `.claude/agents/qa.md` and follow it exactly. Review PR #<n> — <title>. You are part
     of a combined review: do not comment or change labels; end with your verdict, the
     head SHA you reviewed and the comment text."
5. **Decide** (pause checkpoint first: if paused, post nothing and stop):
   - **Request changes** if the playtest reviewer requests changes, or either
     independent reviewer has a blocking finding (`wrap-pr.md` step 2). Post one
     comment: "QA: changes requested", "Reviewed head `<sha>`", the numbered required
     changes (file, what's wrong, what good looks like), then "Suggestions" for non-blocking items. Swap
     `agent:needs-qa` → `agent:changes-requested`. That label starts the Fix task.
   - **Approve** otherwise: post one comment, "QA: approved", "Reviewed head `<sha>`",
     the playtest reviewer's 2–3 line summary, "Independent review: correctness ✓
     consistency ✓" (or "skipped (small diff)" / "skipped (small fix)"), and any
     non-blocking suggestions (file `P3` issues for the ones worth doing), and the `verify` state on that head
     as you just read it: "`verify`: success / running / failed". State that fact only: never
     predict whether or when the PR will merge (the auto-merge workflow decides that, and says
     so on the PR if it can't). Then swap `agent:needs-qa` → `agent:qa-approved`.
   - **Close** if it has been sent back 3 times already: close the PR, label its issue
     `agent:blocked`, and explain for the Director.
   - Say "merge conflict only; full review passed" in a change request whose only
     required change is resolving a conflict, so the next round can be light.
