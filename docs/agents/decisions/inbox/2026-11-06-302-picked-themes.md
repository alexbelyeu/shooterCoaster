## 2026-11-06 — Picked title + level1 themes are the default; `?theme=` stays for later rounds; the title has no layers (Sound designer, #302)

**Context:** Alex picked "Neon Marquee" for the title and kept "Midway Rush" for level1 (#301). Decision
`2026-11-02 — Theme options live beside the scores` says later listening rounds (levels 2–5) reuse the flag and folder.
**Decision:** `title.neon` replaced `title.scrim` (A minor in `SCORE_KEYS`); every option file, its `SCORE_KEYS` row
and its renders are deleted. `scores/index.ts` reads `scores/themes/*.scrim` by `import.meta.glob`, so the `?theme=`
mechanism stays with an empty folder and a new round only adds files plus their `SCORE_KEYS` rows. The title score is
not tagged with `layer=`: nothing sets an intensity on the title, so a layered title's loop would open on whatever
intensity the last run left (the player's intensity is global), often base alone. Only level scores carry layers.
**Consequences:** `?theme=<name>` does nothing until a round adds options. Tagging the title would need the player
to hold the title at full intensity first.
