## 2026-11-01 — Tone.js music tracks start on the next beat, not the next bar (Builder, #168)

**Context:** `startTransportAt` started a new track on the next bar line (2.2 s at 108 bpm, 3.3 s at 72 bpm) while the
outgoing bus faded to 0 in `MUSIC_FADE_S` (1 s), so a switch was often a fade out, silence, then the new track: a gap.
**Decision:** a new track starts on the next beat (≤ 0.83 s at the slowest tempo), and the Transport's tempo steps to the
new bpm on that beat instead of ramping, so the incoming track is in time from its first note (the step lands under the
outgoing track's last ~fraction of its fade). Both gain ramps still start at the switch, a constant-sum crossfade. The
fade log records each ramp's start and the incoming track's `firstNote`; the smoke fails a switch whose first note lands
after the outgoing fade ends.
Entering a run, the title track is handed over (`fadeOutMusicBus(..., untilNextTrack)`, scrim `handOverScore`): it keeps
playing until the level's track opens once its scene has mounted, and only then fades out under it (a 20 s fallback fades
it if no track opens). The smoke requires every checked switch to have an overlapping fade-out / fade-in pair.
**Consequences:** tracks no longer line up with the old track's bar grid (inaudible: it is fading out). Do not go back to
bar-aligned starts without also delaying the outgoing fade to the new track's first note.
