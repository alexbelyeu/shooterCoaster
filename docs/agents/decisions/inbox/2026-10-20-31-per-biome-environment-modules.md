## 2026-10-20 — Biome environments are per-biome modules behind a registry (builder, #31)

**Context:** `BiomeEnvironment.tsx` and `BiomeDecorations.tsx` were ~1000 lines each of
five biomes' worth of switch cases, so every level task edited the same two files and
parallel builders conflicted.

**Decision:** Each biome owns a folder `src/levels/environments/biomes/<biome>/`
(`config.ts` with terrain `COLOR_RAMP` + `TREES`, `Decorations.tsx`, `Features.tsx` for
landmarks / terrain features / events, `index.ts` exporting a `BiomeDefinition`).
`biomeRegistry.ts` maps `BiomeType → BiomeDefinition` as a `Record`, so a missing biome
is a compile error. Biome-agnostic code (terrain mesh + colour-ramp sampler, tree field,
water shader, atmosphere/lights/fog wiring, `scatterPositions`, `safeHeight`) lives once in
`shared/`. `BiomeEnvironment.tsx` is a thin host that renders atmosphere, terrain, water,
trees, then the definition's `Decorations` and `Features` — in that order, which preserves
the previous scene-graph order. No file under `src/levels/environments/` should exceed
~400 lines; split large decoration sets into sibling components (as `desert/Cacti.tsx`).
Terrain noise (`BIOME_TERRAIN_CONFIGS`) and sky/fog (`ATMOSPHERES`) stay where they were.

**Consequences:** New biome work touches only its own folder plus one registry line, so
parallel level PRs stop colliding. Never add per-biome `if (biome === …)` branches back
into `BiomeEnvironment.tsx`; put them in the biome's `Features.tsx`. Landmark components
(FerrisWheel, Pyramid, Volcano…) still live at the `environments/` root because the title
scene reuses some of them.
