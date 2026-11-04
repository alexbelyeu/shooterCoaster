## 2026-11-03 — Arcade SFX: a placed sound keeps its louder channel at its level (Sound designer, #321)

**Context:** The arcade engine pans each mono one-shot with a StereoPannerNode (equal power), so a sound at the centre
of the screen plays 3 dB down in both channels, while one at the side is up to 3 dB hotter in its near channel. The
enemy just shot is usually near the crosshair, so the most common kill was the quietest: in the level1 combat mix a
centred 1× kill read 4.6 dB over the music (target ≥ 6), against 7–8.7 dB for kills off to the side.
**Decision:** A placed sound (kills, hits) gets `panGain(pan)` (`sfxDesign.ts`): the louder channel stays at the sound's
level wherever it pans (+3 dB at the centre, 0 dB at the edges). Unplaced sounds (gun, cues, UI) stay as they were. The
kill bodies come down 1 dB (−3 dB, the hiss −4 dB), so the edges, which already met the master limiter, sit under it.
**Consequences:** Every kill clears the music by ≥ 6.7 dB in the level1 mix (seeds 1–3: 6.7 / 6.8 / 6.9), true peak
stays at −1.0 dBTP and short-term max at −13.0 LUFS, the top of its −15…−13 range. Centred hits are up to 3 dB louder
than before. The SFX sheet renders sounds unplaced, so it shows each sound 1 dB under the mix's centred kills.
