## 2026-11-21 — Support towers merged into one mesh; the dust bunny's roll is a morph (builder, #806)

**Context:** Level 6's ride shot drew 136 against its 130 budget after the bigger gym (#761). At 10 s about 40
dust bunnies are on screen, each two meshes (the rolling fluff, the eyes kept on its front), and every level's
support towers were one `InstancedMesh` per height bucket (8 draws; DECISIONS "one InstancedMesh per height bucket").
**Decision:** `buildTowersGeometry` (`src/track/supportTowers.ts`) merges every placed tower, its bucket's geometry
turned and moved (its `aThick` turned with it), into one mesh: one draw, the same triangles. The dust bunny is one
mesh, `DUST_BUNNY_GEO`: its fluff rolls about x by two relative morph targets (`dustBunnyRoll`: weights cos − 1 and
sin), its eyes have none, and an `aGloss` attribute keeps the eyes' roughness and metalness in `DUST_BUNNY_MAT`.
`ShaderWarmup` compiles the morph variants of its paint and of the hit flash.
**Consequences:** Level 6's ride shot 136 → 94 draws (objects 123 → 78), no new programs after the warm-up; every
level with towers draws 7 fewer. The towers are no longer culled per bucket (they rarely were: a bucket spans the
ride). Budgets unchanged.
