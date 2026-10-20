# Decisions inbox

Every new decision entry goes here as **its own file**, never as an edit to
`docs/agents/DECISIONS.md`. New files never conflict, so parallel PRs stop colliding.
The Maintainer folds this inbox into `DECISIONS.md` every night and deletes the
folded files, so this folder only ever holds a day or so of entries.

**File name:** `YYYY-MM-DD-<issue-or-pr-number>-<short-slug>.md`, for example
`2026-10-20-14-hit-feedback-pooling.md`.

**Contents:** same format as `DECISIONS.md`.

```
## YYYY-MM-DD — Title (role, #issue)

**Context:** …
**Decision:** …
**Consequences:** …
```

Write an entry only for a non-obvious choice someone could later undo by mistake:
architecture, conventions, budgets, network calls, licences, direction changes. Keep it
short. Implementation detail belongs in code comments and the PR description.
