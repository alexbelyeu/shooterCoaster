## 2026-10-30 — Death effects: one pool, styles as data, shared meshes (Builder, #29)

**Context:** Every enemy died in the same random-coloured fireball. Each type needs its own
death (confetti, feathers, splash, shards, motes…), and the boss framework reuses the pool
for weak points.

**Decision:** `ParticleExplosion` stays the one pooled effect, with `explode(position, style)`.
A `DeathStyle` (layers of shape / colours / speed / drag / gravity / size / spin, plus
lifetime, scale, lift, flash, kill timbre) per `EnemyType` lives in pure `effects/deathStyles.ts`.
All 8 slots share two InstancedMeshes (unlit boxes for every glow / flat shape via per-instance
stretch, and lit dodecahedra for chunks), with per-instance colour, instead of meshes per slot:
2 draw calls instead of the old 10. Ages run on game time (frenzy slow-mo slows a death; pause
holds it) and `holdFeedback` stops them at `HOLD_LIFE` so combat screenshots show the style.
Kill timbre per family (pop / flutter / crunch / splash / hiss) reshapes the existing snap +
ping voices (`KILL_TIMBRES`), so no new Tone nodes.

**Consequences:** A new enemy type needs a `DEATH_STYLES` entry (the `Record` enforces it; the
unit test checks it fits a slot and differs from the other types in its level). New effect
looks are new data, not new components. Particle fade is a size shrink (one shared opaque
material per mesh), so no per-particle opacity.
