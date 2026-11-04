## 2026-11-02 — Score intensity layers: per-voice level gains, intro plays everything, wind-down a layer a bar (Sound designer, #321)

**Context:** The score engine's level music should follow the combo (base / +drums / +lead / FRENZY), for any score,
without breaking parity with the original Scrimshaw compiler or growing the node count.
**Decision:** A voice joins a layer with `layer=` (untagged = `base`; the field is absent otherwise, so parity
`toEqual` holds). Intensity is the combo tier index, sent by `LevelAudio` every frame. A layer is each voice's own level
gain ramped over 50 ms ending on a loop beat line, so no new nodes; silent voices keep playing their notes so a layer
comes in mid-phrase. A layered score gets one low-pass per track, 7 kHz below FRENZY, opened to 20 kHz at FRENZY;
untagged scores get none. The intro always plays every layer (it is the countdown fanfare). A rise lands on the next
beat; a fall drops one layer on the next beat and one per bar after, each asked for once the previous one has landed.
**Consequences:** Scores must make `base` stand alone (`scores.test.ts` checks it plays in every loop bar). The music
bus compressor keeps loudness nearly level across layers (level1: −16.6 → −17 LUFS), so layers read as density and
brightness, not volume. A FRENZY lost a fraction of a beat after it was asked still sounds for a bar. A pause keeps the layers: a session resumed before a scheduled step lands (a pause
during the intro, or just before a beat line) opens on what was playing and still takes the step on its beat line
(`resumeLayers`). FRENZY keeps both lifts: the arcade's `frenzyLift` loop is the SFX riser, the score's low-pass opening
is the music's; the slow-mo duck hides the opening for its 1.5 s, and the score stays bright for the rest of FRENZY.
