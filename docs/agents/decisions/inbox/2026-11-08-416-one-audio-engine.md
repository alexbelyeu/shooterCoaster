## 2026-11-08 — One audio engine: the score engine + arcade SFX; Tone.js removed (Sound designer, #416)

**Context:** Alex, 2026-11-07: once the melody fix (#415) and the level 2–5 themes (#392) were in, the score engine
becomes the only engine, "no need for fallback ?audio=tone. this can be fully removed". The score engine and the
arcade SFX already drew everything in plain Web Audio; Tone.js was left supplying only the context, the master
chain and the offline renders.

**Decision:**
- No `?audio=` flag: every visitor gets the score engine and the arcade SFX. `tone` is out of `package.json`; the
  context and master chain are plain Web Audio in `src/audio/AudioEngine.ts` (main chunk, tiny), and both engines
  stay lazy chunks loaded after the first gesture. `?theme=` stays for listening rounds.
- Offline renders (`npm run audio:render`) use an OfflineAudioContext on a scripted clock (`offlineRender.ts`).
  `--engine scrim` is gone; `--engine port|original` stays for `--score` parity renders. Renders lose the
  `scrim-` prefix.
- Every game stereo panner is an `upmixPanner` (`channelCountMode: 'explicit'`: a mono voice is copied to both
  channels before panning, no 3 dB centre dip). Every score and SFX level was mixed and measured on renders
  through Tone's offline context, i.e. standardized-audio-context, whose StereoPannerNode is always 'explicit'.
  On the spec's 'clamped-max' the SFX came out 3 dB quieter, kills under the 6 dB-over-music target, and the
  scores 0.7 LU quieter and narrower. With it, the re-renders match the old ones within 0.1 LU. The jukebox
  voicing (parity with the original page) keeps the spec's panner.
- Parameter ramps that start mid-ramp use `cancelAndHoldAtTime` (`AudioEngine.rampParam`): an offline context's
  `AudioParam.value` is still the start value, so reading it there jumped the slow-mo duck open with a click.
- Budgets lowered to lock in Tone's size: `jsTotalGzipKB` 700 → 630, `startupJsGzipKB` 440 → 435.

**Consequences:** One engine to maintain and measure; renders hear exactly what players hear. Switching a panner
back to the spec's mode changes the whole mix by 3 dB: don't, without re-measuring every level's `--mix`. The
`baseline-*` renders (the Tone.js sound) can no longer be re-rendered and stay as a record.
