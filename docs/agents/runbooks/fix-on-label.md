# Fix (on label)

A GitHub event started this run: QA labelled a pull request `agent:changes-requested`.
Get **only that PR** fixed, through one builder subagent, then stop. New issues are left
to the scheduled builder runs. If no pull-request number came with this run (someone
pressed Run now), reply "No PR event — nothing to do" and stop.

1. Re-read the PR. Continue only if it is open, not a draft, its head branch starts with
   `agent/`, and it is labelled `agent:changes-requested`. Otherwise reply "Nothing to
   fix" and stop.
2. If it has been sent back 3 or more times, leave it for the Director: reply so and stop.
3. If the PR has a *live* `Builder run … is on it` claim (see "Live claims" in the
   runbooks README: under 2 hours old, posted after the latest QA change request, with
   no builder reply after it), reply "Already being fixed" and stop. Otherwise comment
   `Builder run <ISO timestamp> is on it`, wait about 20 seconds and re-read the
   comments. If another live `… is on it` claim is earlier than yours, comment
   `Backing off — already claimed by another run` and stop.
4. Spawn exactly one builder with the Agent tool (`subagent_type: "general-purpose"`,
   `model: "opus"`, `isolation: "worktree"`, `run_in_background: false`), prompt: "You
   are a Builder for ShooterCoaster. Your working directory is a git worktree of
   alexbelyeu/shootercoaster. Read `.claude/agents/builder.md` and follow it exactly.
   Your assignment: PR #<n>, returned by QA — address every QA comment."
5. When the builder finishes, check the PR is labelled `agent:needs-qa` (that label
   starts a QA review automatically). If the builder died without that, comment what
   happened and leave the PR labelled `agent:changes-requested` for the next scheduled
   builder run. Reply with one line: PR number and outcome.
