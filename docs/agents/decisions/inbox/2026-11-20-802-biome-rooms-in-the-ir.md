## 2026-11-20 — Biome acoustics live in the impulse response, boss cues placed (Sound designer, #802)

**Context:** Each biome's SFX room was `makeIR` with a different length and tone. The issue asked for a pre-delay,
early reflections and a desert slapback per biome, and for the boss's cues to be placed like hits and kills.
**Decision:** The arcade engine builds its room from its own pure `roomImpulse` (`sfxDesign.ts`), seeded per biome,
instead of the score engine's `makeIR` (which the music keeps): the pre-delay is leading silence, the early
reflections and the slap are impulses in the IR, sized as a share of the tail's energy. No delay or filter nodes
were added, so the node and voice counts are unchanged. A placed sound's send is multiplied by `wet` (1 near,
`SPATIAL.farWet` far, `placedSend` caps it at 1). `bossArrival` / `bossHit` / `bossDefeat` dropped 3 dB in
`ARCADE_SOUNDS`: placed, `panGain` gives that back at the centre, so the boss mix holds its level; `boss:spawn` is
now emitted on the boss's first placed frame (not its activation effect) so the event carries where it arrives.
**Consequences:** Convolver normalisation keeps each room's wet energy about the same whatever its early / slap
share, so retuning those changes the room's character, not its loudness. A new biome needs the three new fields
(the `new-world` templates have them); `sfxDesign.test.ts` fails a biome whose room is the same as another's.
