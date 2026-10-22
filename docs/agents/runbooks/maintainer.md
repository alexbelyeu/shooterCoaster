# Maintainer (nightly)

Read `.claude/agents/maintainer.md` and carry out that role yourself in this session, in
the order it gives. Every PR you open goes to QA with `agent:needs-qa` (reverts: title
`revert: …` + `P1`); there is no self-approval.

**Claiming (tech debt):** builder runs may be claiming at the same moment. Only consider
issues still labelled `agent:ready`. After you claim one (swap `agent:ready` →
`agent:in-progress`, comment `Claimed by maintainer run <ISO timestamp>`), wait about 20
seconds and re-read its comments. If another run's claim comment is earlier than yours,
back off: comment `Backing off — already claimed by another run`, leave its labels
alone, and pick the next candidate (verify that one too).

**Updating other PRs:** before touching someone else's open PR, check its latest
comments; if it has a live builder or QA claim (runbooks README, "Live claims"), skip
it. Update a branch by merging `origin/main` into it and pushing normally; never rebase or force-push.

If you take on a tech-debt issue, you may delegate it to one Agent call with
`subagent_type: "general-purpose"`, `model: "opus"`, `isolation: "worktree"`, telling it
to follow `.claude/agents/builder.md` for that issue. Pause checkpoint before it.

End with the health summary that file asks for, plus any claims you backed off from.
