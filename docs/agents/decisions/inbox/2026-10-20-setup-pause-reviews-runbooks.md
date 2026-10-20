## 2026-10-20 — Pause switch, independent code reviews, runbooks in the repo (setup)

**Context:** Alex needs to stop all agent work quickly when his Claude usage runs low,
wants Story Pitcher's `/deslop` and `/wrap-pr` review discipline on every PR, and
changing a scheduled task's prompt needed his hands or hit permission checks.

**Decision:** An open issue labelled `pause` (or `pause: true` in STEERING.md) stops every
agent at its next checkpoint, via `scripts/pause-check.sh`, which fails closed;
`PAUSE until <time>` resumes by itself. QA combines a playtest reviewer with two
fresh-context reviewers (`pr-correctness`, `pr-consistency`) reading one review bundle,
for code diffs of ~300+ lines, and posts one decision; builders deslop before shipping.
Scheduled-task prompts become a bootstrap that runs the pause check and follows
`docs/agents/runbooks/<task>.md`.

**Consequences:** Pausing needs no PR and works from a phone. Big PRs cost two extra
read-only reviewer runs (~30k tokens of bundle each), offset by fewer QA round trips.
Behaviour changes to any role now ship as reviewed PRs; the task prompts should rarely
change again.
