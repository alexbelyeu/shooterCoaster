## 2026-11-02 — Theme options live beside the scores, behind `?theme=` (Sound designer, #216)

**Context:** The taste gate needs two or three candidate themes per slot playable in the game before Alex picks one, without changing what anyone hears by default.
**Decision:** Candidates are ordinary scores named `<slot>.<name>` in `src/audio/scores/themes/`, listed in `SCORES` with their own `SCORE_KEYS` entry. `?audio=scrim&theme=<name>[,<name>]` swaps them in through `scoreIdFor(slot)`, read by the score player and the arcade SFX bake only; tracks keep their slot id, so crossfades, hand-overs and the e2e checks are unchanged. Once Alex picks, the winner's text replaces `<slot>.scrim` and the losing options are deleted with their `SCORE_KEYS` rows.
**Consequences:** The lazy score-engine chunk carries the options until the pick (about 5 KB gzipped); default players never download it. Any later listening round (levels 2–5) reuses the same flag and folder.
