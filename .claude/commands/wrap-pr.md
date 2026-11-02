# Wrap PR: independent reviews

Two fresh-context reviewers read the PR cold, in parallel: `pr-correctness` (does it
work: bugs, leaks, frame-rate and lifetime problems) and `pr-consistency` (is it the
right solution: reuse, architecture, CLAUDE.md conventions). QA runs this alongside the
playtest review on every PR the size gate below lets through. Anyone can also run it by hand on a
branch: `/wrap-pr` or `/wrap-pr <PR number>`.

This must run in a top-level session (a QA session or an interactive session):
subagents cannot spawn subagents.

## 0. Check out the PR and build the bundle

```bash
git fetch origin main "pull/<n>/head:pr-<n>" && git checkout pr-<n>
.claude/scripts/review-bundle.sh origin/main "${TMPDIR:-/tmp}/review-bundle-<n>.md"
```

Replace the `## Intent` placeholder in the bundle with 5–10 lines on what the PR is
trying to do, from the PR description and its linked issue (including its acceptance
criteria). The reviewers run cold; this is the one thing they cannot derive from the
diff.

**Size gate:** if the code diff is small,
`git diff origin/main...HEAD --shortstat -- src e2e scripts .github` under ~300
changed lines, or the PR is docs-only, skip the two reviewers: the playtest reviewer
covers it. On a **re-review after a fix**, measure only the fix (commits since the head
the last QA comment reviewed; `--first-parent` keeps out the commits a merge of `main`
brings in):
`git log --first-parent --no-merges --numstat --format= <reviewed-head>..HEAD -- src e2e scripts .github | awk '{n+=$1+$2} END {print n+0}'`.
Under ~300, skip them too. Say "independent review skipped (small diff)" or "(small
fix)" in the decision comment.

## 1. Two reviewers, in parallel

Spawn both in a **single message**, no worktree needed. They read this checkout as well
as the bundle, so leave it on the PR branch until both have finished: no merges and no
checkout of `main` here (QA on label playtests in a worktree of its own,
`docs/agents/runbooks/review-one-pr.md` step 4).

- `subagent_type: "pr-correctness"` and `subagent_type: "pr-consistency"`, if those
  agent types are available in this session. Otherwise use
  `subagent_type: "general-purpose"` with the prompt "Read
  `.claude/agents/pr-correctness.md` (or `pr-consistency.md`) and follow it exactly."
- Prompt: the branch name and the bundle path. Nothing else: the rubric lives in the
  agent definitions and the context lives in the bundle.
- Model: `opus`, or the same or higher tier than whoever wrote the code.

## 2. Synthesize

Don't paste raw reviewer output into the PR. Merge the findings into the decision:

- **Blocking**: correctness `high`, or consistency `high` / "Needs rethink". These
  go into the change request as numbered required changes, each with the file and
  the fix.
- **Non-blocking**: everything else, as a short "Suggestions" list. A suggestion
  that deserves its own work becomes a `P3` issue labelled `agent:ready`; link it.
- A reviewer's finding you verified to be wrong is dropped, with one line saying why.

When run by hand (no QA decision to make), post the synthesis as one PR comment
titled `Independent review` and end with the PR URL on its own final line.
