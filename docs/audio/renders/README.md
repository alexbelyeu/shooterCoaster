# Audio renders

Short offline renders of the game's music and SFX, for Alex to listen to from GitHub.
Use a file's raw link to play it in the browser. The Sound designer writes these
(`.claude/agents/sound-designer.md`).

- `<name>.mp3`: at most 30 s, 128 kbps
- `<name>.json`: its measurements (LUFS, true peak, band energy, seam jump)
- `<name>.png`: its spectrogram, at most ~150 KB

Revisions overwrite the same names, so this folder always holds the current sound.
