## 2026-10-30 — The score engine runs on Tone's context, in its own stereo channel, loaded only under ?audio=scrim (Sound designer, #214)

**Context:** The Scrimshaw port has to run beside Tone.js until it reaches parity (hard rule 7), share the
game's ducking, volume and limiter, and leave default players' sound and bundle untouched.
**Decision:** `src/audio/scrim/` creates its Web Audio nodes on Tone's raw context (standardized-audio-context's,
so they connect to Tone nodes) and plays into `AudioEngine.scoreChannel`, a second music channel built with
`channelCount: 2`: Tone's channels fold their input to mono, which would flatten the scores' panning. It is
silent and unused without the flag (renders of the default sound match the baseline to −142 dB). The engine
and the scores are one lazy chunk (`musicEngine.withScrim`), so `?audio=scrim` costs default players nothing.
The `game` voicing (`GAME_VOICING` in `synth.ts`: 32 Hz high-pass, −6 dB limiter, out 0.53) sets scores to
−18…−16 LUFS through that channel; the port's `jukebox` voicing stays the original's, for parity renders.
Unlike the Tone.js music, a score holds its position while the run is paused and resumes there, and the results
screen gets its own score.
**Consequences:** When the score engine becomes the default, `musicChannel` and the Tone music managers can go;
`scoreChannel` stays. Offline renders seed `Math.random` the same way for the original page and the port, so a
parity render of the same score is near bit-identical; any change to the port's call order of `Math.random`
shows up there.
