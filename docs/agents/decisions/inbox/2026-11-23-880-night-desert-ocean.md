## 2026-11-23 — Night Rides for the Desert and the Ocean: night-only props mount, the moon doesn't flare (builder, #880)

**Context:** #880 gives levels 2 and 3 a Night Ride through `NIGHT_ATMOSPHERES` (#829). The desert's lit props are
new (torches on the Pyramid), and its `SunFlare` would flare and streak off the moon in the sun slot.
**Decision:** A night-only prop mounts only when the atmosphere's `lampGlow` is above 0 (the Pyramid's `Torches`, one
instanced draw), so the day's scene, draw calls and programs are untouched; the warm-up compiles it on a night run
because it is in the scene from the first frame. The desert's `SunFlare` is not mounted at night. The ocean needs no
new prop: its jellyfish already have emissive cores, the rim lift makes their bells glow, and the water's sun glint
under a lowered moon is the moon path. The smoke's nightly `night` step runs on every level in `STEP_LEVELS.night`
and reports programs after warm-up.
**Consequences:** The nightly `deep` part rides two more Night Rides (~40 s each). Levels 4–6 follow the same way:
a preset, their own lamps through `lampGlow`, and their id in `STEP_LEVELS.night`.
