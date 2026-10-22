## 2026-10-22 — Desert terrain material hook, CPU-occluded sun flare (builder, #23)

**Context:** Level 2 needed sand ripples on the terrain, which every biome drew with
the same inline Phong material in `BiomeEnvironment`. The issue also asked for a lens
flare hidden "by a depth test on an occlusion probe", but a depth test result only
comes back to JS through WebGL2 occlusion queries, which three.js doesn't wrap and
which answer a few frames late.
**Decision:** `BiomeDefinition.createTerrainMaterial` (optional) lets a biome swap the
terrain material; the desert's patches Phong with `onBeforeCompile` (`sandRipples.ts`).
Its sand mask compares vertex-colour g/r in **linear** space (THREE.Color stores hex
colours linear), so retuning the desert ramp can turn ripples on the red rock or off
the sand. The flare is two additive quads: a depth-tested core billboard at the sun
(the GPU hides it behind terrain, mesas and the pyramid pixel-exactly) and a
screen-space ghost/streak quad whose strength comes from a CPU ray march against the
drawn terrain (`groundFn`) plus cone occluders for the mesas and pyramid
(`sunOcclusion.ts`), smoothed over ~0.2 s. `buildRingedRock` moved from the ocean
biome to `shared/ringedRock.ts` so mesas and sea stacks share it.
**Consequences:** A new tall desert landmark should be added to the flare's occluder
list in `biomes/desert/Features.tsx`, or the ghosts will show through it (the core
still hides).
