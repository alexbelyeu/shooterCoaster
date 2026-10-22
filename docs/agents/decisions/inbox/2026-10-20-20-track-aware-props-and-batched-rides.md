## 2026-10-20 — Track-aware prop layout; batched rides; only live bullets drawn (builder, #20)

**Context:** Level 1 was at 277 draw calls / ~197k triangles before adding the midway
(budget in #20: ≤ 215 / ≤ 200k). Each Ferris wheel was ~88 meshes and each carousel ~27;
the bullet pool drew all 350 instances (~39k triangles) even when idle. Theme Park props
were scattered by radius from the origin, so two rides and several tents sat under the
track, with support towers running through them.

**Decision:** Props that must avoid the track are planned as pure data against
`shared/trackClearance.ts` (`buildTrackIndex`, a 2D XZ query: towers reach the ground, so
height does not make a spot safe) and unit-tested against the real track
(`biomes/themePark/layout.ts` + `layout.test.ts`). Anything hung across the track (arch,
bunting) must also have the rider already below it for a stretch of approach, so it is
ridden under and not dived through. Biome `Decorations`/`Features` now receive `groundFn`
and the track's `ArcTable`. Multi-part props are one draw call per part type: InstancedMesh, or
`shared/paintedParts.ts` (vertex-coloured parts merged into one geometry). The Ferris
wheel is now 4 draws and the carousel 2. `BulletPool` sets `mesh.count` to the live bullets.

**Consequences:** Level 1 now renders ~100–130 draw calls and ~165k triangles with the
full midway in view. Moving a ride means updating `RIDES` in `themePark/parkSpec.ts`; the
layout test fails if it lands on the track. Don't go back to one `<mesh>` per prop part.
