## 2026-11-06 — Theme options are written in intensity layers; the registry reads `themes/` by glob (Sound designer, #303)

**Context:** The first listening round (#216) wrote its options without `layer=` tags, so a pick
needs rewriting before it can follow the combo. #303 adds twelve options for levels 2–5 while
PR #386 (the #301 picks) also edits `scores/index.ts`.
**Decision:** Every level option tags its voices base / drums / lead / frenzy, so Alex's pick
replaces `<level>.scrim` unchanged. Its seam render holds every layer (`--layers 3`), since a
seam render opens inside the loop at intensity 0. `scores/index.ts` reads `themes/*.scrim` with
`import.meta.glob`, the same change as #386, so a listening round adds only score files and their
`SCORE_KEYS` rows.
**Consequences:** The scores add ~43 kB (~7.5 kB gzip) to the lazy `?audio=scrim` synth chunk
until the losing options are deleted. A theme option's file name is its `?theme=` id, so names
must stay unique across slots.
