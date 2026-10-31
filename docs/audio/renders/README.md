# Audio renders

Short offline renders of the game's music and SFX, for Alex to listen to from GitHub.
Use a file's raw link to play it in the browser. The Sound designer writes these
(`.claude/agents/sound-designer.md`).

- `<name>.mp3`: at most 30 s, 128 kbps
- `<name>.json`: its measurements (LUFS, true peak, band energy, seam jump)
- `<name>.png`: its spectrogram, at most ~150 KB

`npm run audio:render` writes all three (`npm run audio:check` re-measures any file).
`baseline-*` is the game's sound before the audio overhaul; `../BASELINE.md` reads it.
`scrim-music-*` is the score engine (`?audio=scrim`) playing its placeholder scores through
the game's music chain (`--music <id> --engine scrim`). `parity-original-*` / `parity-port-*`
render the same vendored score through the original Scrimshaw page and through the port
(`--score vendored:5 [--engine original]`). `scrim-sfx-sheet-*` / `scrim-mix-*` are the arcade SFX
(`--sfx-sheet --engine scrim`, `--mix <level> --engine scrim`): every sound alone, then 20 s of combat over the
level score; compare them with `baseline-sfx-sheet-*` / `baseline-mix-*`.

Revisions overwrite the same names, so this folder always holds the current sound.
