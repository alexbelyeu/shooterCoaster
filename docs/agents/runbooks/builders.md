# Builders (scheduled)

You are the builder dispatcher. You coordinate; parallel builder subagents do the
engineering. New issues start here; PRs sent back by QA are normally fixed by the
Fix (on label) task within minutes, so you only pick those up if they've waited.

1. Read `builder_parallelism` (N) from STEERING.md (default 2, max 4).
2. Pick up to N assignments, in this order:
   a. Open, non-draft PRs labelled `agent:changes-requested` with no *live*
      `Builder run … is on it` claim (runbooks README, "Live claims"), oldest first.
   b. Open issues labelled `agent:ready` (never `agent:in-progress`), excluding
      `epic` and `pause`, ordered P1 > P2 > P3; within the same priority, issues
      labelled `steering` (Alex's own requests) first; then oldest first.
   c. If nothing is left, take the top item of the "Idea backlog" in
      `docs/agents/VISION.md`, create a well-formed issue for it per the issue contract
      in PROTOCOL.md (labels `agent:ready`, `P3`, a `type:*`), and use that.
   If there is still nothing to do, reply "Queue empty" and stop.
   Don't pair two assignments that will clearly edit the same functions in the same
   files (their issues' Scope sections say so); take the next candidate instead.
3. Claim every assignment before spawning anyone: for issues swap `agent:ready` →
   `agent:in-progress` and comment `Claimed by builder run <ISO timestamp>`; for
   returned PRs comment `Builder run <ISO timestamp> is on it`.
4. **Verify every claim.** Wait about 20 seconds, then re-read each issue's/PR's
   comments. Back off if, for an issue, another run's claim comment is earlier than
   yours or another run claimed it within the last 6 hours; for a returned PR, only if
   another *live* `Builder run … is on it` claim (runbooks README, "Live claims") is
   earlier than yours (the previous round's claim has ended). To back off,
   comment `Backing off — already claimed by another run`, leave its labels alone, and
   replace it with the next candidate (claim and verify that one the same way).
5. Pause checkpoint. Then spawn all builders **in a single message** with the Agent
   tool, one call per verified assignment: `subagent_type: "general-purpose"`,
   `model: "opus"`, `isolation: "worktree"`, `run_in_background: false`, prompt:
   "You are a Builder for ShooterCoaster. Your working directory is a git worktree of
   alexbelyeu/shootercoaster. Read `.claude/agents/builder.md` and follow it exactly.
   Your assignment: issue #<n> — <title>" (or "PR #<n>, returned by QA — address every
   QA comment").
6. When they finish, check each assignment ended in an open PR labelled
   `agent:needs-qa` or an issue labelled `agent:blocked` (or was stopped by a pause).
   If a builder died without either, push whatever branch exists as a draft PR if
   useful, return the issue to `agent:ready` and comment what happened.
7. Reply with one line per assignment: issue/PR, outcome, PR number, plus any claims
   you backed off from.
