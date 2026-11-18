## 2026-11-18 — Review bundle: code diff only, no repeated CLAUDE.md (Alex's session)

**Context:** QA (on label) averaged ~310k weighted tokens a run; both independent reviewers read
the same bundle, which pasted CLAUDE.md (already in their context), the 26 KB level-design skill,
and a 30-line-context diff in which one edited CLAUDE.md / code-map row (each a very long line)
cost 30-40 KB. Bundles for #649 / #653 / #654 were 258 / 193 / 102 KB.

**Decision:** `.claude/scripts/review-bundle.sh` diffs code only, with 10 lines of context; docs
(`*.md`) and audio render data are listed by name with the command to diff one; CLAUDE.md is
not repeated; the heap rules stay inline for `src/` changes; the level-design skill is a pointer
reviewers grep. Same PRs: 86 / 30 / 21 KB.

**Consequences:** Reviewers open a file (Read with offset/limit) when a concern needs more than
10 lines around a hunk, and diff a doc by hand when its content matters. Don't re-add whole
files to the bundle; point to them.
