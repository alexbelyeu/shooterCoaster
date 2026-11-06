# Audio renders

Short offline renders of the game's music and SFX, for Alex to listen to from GitHub.
Use a file's raw link to play it in the browser. The Sound designer writes these
(`.claude/agents/sound-designer.md`).

- `<name>.mp3`: at most 30 s, 128 kbps
- `<name>.json`: its measurements (LUFS, true peak, band energy, seam jump)
- `<name>.png`: its spectrogram, at most ~150 KB

`npm run audio:render` writes all three (`npm run audio:check` re-measures any file).
`baseline-*` is the game's sound before the audio overhaul; `../BASELINE.md` reads it.
`scrim-music-*` is the score engine (`?audio=scrim`) playing its scores through
the game's music chain (`--music <id> --engine scrim`; `-seam` renders start 10 s before the first loop seam, `--seam`). The
title ("Neon Marquee") and level1 ("Midway Rush") are Alex's picks (#301); levels 2–5 are still placeholders. level1's has intensity layers, so it
is rendered per layer: `scrim-music-level1` climbs through every layer and loses the combo
(`--layers ramp`, 30 s), and `scrim-music-level1-base` / `-full` / `-frenzy` hold intensity 0 / 2 / 3
(`--layers <n>`, 20 s). `parity-original-*` / `parity-port-*`
render the same vendored score through the original Scrimshaw page and through the port
(`--score vendored:5 [--engine original]`). `palette-*` is the arcade instrument palette:
each new instrument alone (`palette-melodic`, `palette-drums`) and an 8-bar groove using only
it (`palette-groove`), scores in `../palette/`, rendered with `--score <file> --chain game`.
`scrim-sfx-sheet-*` / `scrim-mix-*` are the arcade SFX
(`--sfx-sheet --engine scrim`, `--mix <level> --engine scrim`): every sound alone, then 20 s of combat over the
level score; compare them with `baseline-sfx-sheet-*` / `baseline-mix-*`.

During a listening round, `theme-<slot>-<name>` / `theme-<slot>-<name>-seam` are the options waiting on Alex's pick:
the first 30 s of each, and 20 s across its loop seam (`--music <slot>.<name> --engine scrim [--seam]`). They are
deleted with the losing options once he picks.

Revisions overwrite the same names, so this folder always holds the current sound.
