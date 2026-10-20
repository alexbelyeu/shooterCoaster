## 2026-10-20 — Tone.js trigger times are kept strictly increasing (Builder, #14 / PR #60)

**Context:** CI smoke (mobile run) failed on PR #60 with an uncaught Tone.js
`Start time must be strictly greater than previous start time`. When the audio
clock falls behind (headless CI, a busy phone), Tone clamps late `Sequence`
callback times up to `currentTime`, so two consecutive notes on one mono synth get
the same start. Two shots in one JS turn hit the same thing via `Tone.now()`.

**Decision:** Every mono `Synth`/`NoiseSynth` trigger in the SFX and music managers
goes through `nextTriggerTime(synth, time, ctx.currentTime)` (`src/audio/triggerTime.ts`,
pure and unit-tested). It returns a time that is never in the past and at least
1 ms after that synth's previous start. PolySynths allocate voices, so they don't need it.

**Consequences:** A late note plays up to 1 ms late instead of throwing out of the
Transport tick. New audio code that triggers a mono synth should use the helper.
