## 2026-10-31 — Arcade SFX are baked into AudioBuffers per level and played on a fixed voice pool (Sound designer, #217)

**Context:** The Tone.js kit reuses one synth per sound, so overlapping shots and kills cut each other off, every
trigger needs `nextTriggerTime` to dodge Tone's "start time must be greater" error, and "never create Tone nodes in
a play function" keeps it to a handful of voices. The new SFX (behind `?audio=scrim`, beside the Tone kit until
parity, hard rule 7) should be arcade-loud, layered and positional.
**Decision:** `src/audio/arcade/` renders every one-shot once per level (`bake.ts`: one OfflineAudioContext, the
score engine's instruments and helpers, the level score's key and tempo) into mono AudioBuffers, and plays each as a
fresh AudioBufferSourceNode on one of `VOICE_BUDGET` (24) pre-built voices (gain → low-pass → pan, send to a
per-biome convolver). The source node is the only thing created per sound; it is single-use by design, so there is
no start-time collision to guard. A full pool steals its lowest-priority, oldest voice with a 4 ms fade, or drops a
sound ranked below everything playing (`pickVoice`). For this engine that replaces the "no Tone nodes in a play
function" rule: long-lived node count is fixed (`4 × (24 + 1) + 4`), checked by the smoke under `audioBurst(64, 32)`.
Under the flag the master limiter is a hard-knee compressor (−3 dB, ratio 20, its make-up gain trimmed back), because
Tone's Limiter has a 30 dB soft knee that let kills loud enough to sit 6 dB over the music clip; the default
(Tone.js) sound keeps the old limiter and renders match `main` to −147 dB.
**Consequences:** Changing a sound means changing its recipe or `ARCADE_SOUNDS` and re-rendering
`scrim-sfx-sheet-level1`; a level costs one bake (~25 s of mono audio, a few MB) while its countdown runs. When the
arcade engine becomes the default, `SFXManager` and the soft limiter can go.
