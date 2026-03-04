---
name: shooter-coaster-level-design
description: This skill should be used when building, modifying, or debugging levels in the ShooterCoaster game. It covers track configuration, enemy model design, spawn systems, InstancedMesh decorations, landmark placement, terrain-following, terrain-conforming features, procedural shaders, and the common pitfalls that cause visual bugs. Use when adding new levels, creating new enemy types, adding decorations, fixing scaling/positioning issues, or improving visual quality of existing levels.
---

# Shooter Coaster Level Design

## Overview

Procedural knowledge for building levels in the Three.js on-rails shooter coaster game. Covers the full pipeline from track configuration through enemy design, decorations, landmarks, terrain-conforming features, and procedural shaders. Distilled from extensive iteration across 5 biomes (theme park, desert, ocean, arctic, volcanic).

## When to Use

- Adding a new level or biome
- Creating or overhauling enemy models
- Adding or fixing decorations (InstancedMesh systems)
- Debugging visual issues (floating objects, invisible enemies, stretched geometry, content clustering, terrain clipping, z-fighting)
- Adjusting track scale, spawn radii, or landmark placement
- Improving material quality (specular, iridescence, procedural shaders)
- Building terrain-conforming features (rivers, paths, lava flows)

## Quick Reference — Critical Rules

1. **Track max extent = `varC * 13 * scalar`** — landmarks go BEYOND this, content fills up to 2x this
2. **Never use height-via-scale trick** — `CylinderGeometry(r, r, 1, N)` + `scale.set(1, h, 1)` creates hexagonal sticks. Bake height into geometry.
3. **Ground enemies must sample `heightFn` every frame** via `TerrainContext` — not just at spawn
4. **Paired InstancedMesh callbacks need shared config** — pre-compute random values in `useMemo` arrays
5. **Enemy colors must contrast with terrain** — dark-on-dark = invisible
6. **Add `specular` to MeshPhongMaterial** — flat matte looks like plastic
7. **Scatter radii must extend beyond track extent** — otherwise outer track sections are empty
8. **CircleGeometry needs 24+ segments** — 8 segments = visible octagon
9. **Tree slope rejection must be tight for mountains** — `PI/6` for volcanic/arctic vs `PI/4` for flat biomes
10. **Enemy scale must be 8-20x** when geometry uses small units (radius 2-5) — see Enemy Scaling section
11. **Landmarks must be massive** — double your first intuitive size estimate
12. **Decoration Y offset must be 3-8 units** above terrain — values < 1 cause z-fighting
13. **Terrain-conforming geometry must use safeHeight()** — never flat planes. See Terrain-Conforming Features section
14. **Procedural shaders must use domain warping** — single-direction flow creates stripe artifacts. See Shader section

## Key Files

| File | Purpose |
|------|---------|
| `src/types/level.ts` | BiomeType, EnemyType, EnemyWave interfaces |
| `src/levels/LevelRegistry.ts` | Level configs (track, waves, environment) |
| `src/utils/terrainNoise.ts` | Per-biome terrain noise configs |
| `src/entities/enemies/SharedEnemyAssets.ts` | All shared enemy geometries + materials |
| `src/entities/enemies/*.tsx` | Individual enemy components |
| `src/entities/spawning/EnemySpawner.tsx` | Spawn logic, collision radii, scores |
| `src/levels/environments/BiomeEnvironment.tsx` | Terrain, sky, fog, trees, landmarks, terrain features |
| `src/levels/environments/BiomeDecorations.tsx` | Per-biome InstancedMesh decorations |
| `src/levels/environments/LavaShader.ts` | Procedural GLSL lava material (domain warping + Voronoi) |
| `src/levels/environments/Volcano.tsx` | Volcano landmark component |
| `src/audio/MusicManager.ts` | Per-biome music configs |
| `src/canvas/SceneManager.tsx` | Wires config to spawner + environment |

## Enemy Scaling Reference

Geometry with small unit sizes (radius 2-5) needs large entity scale to be visible:

| Category | Example | Scale |
|----------|---------|-------|
| Flying swarm | EmberWisp, Crow, Scorpion | 8x |
| Ground standard | FireImp | 8x |
| Ground hulk | LavaGolem | 9x |
| Boss / large flying | InfernalDrake | 20x |
| Exception | Snowman (geometry already large) | 1x |

Rule of thumb: if you're unsure, 8x is the safe default for normal enemies. Boss enemies need 15-20x.

## Landmark Sizing Reference

Landmarks must be dramatically larger than intuition suggests:

- Volcano cone: radius 1200, height 1600
- Position: ~2400 units from origin (not further, or it feels disconnected)
- General rule: double whatever size feels "right" on paper, then verify visually

## Terrain-Conforming Features (Rivers, Paths, Lava Flows)

This is the hardest visual problem. Features that sit on terrain (lava rivers, paths, water channels) must follow terrain exactly.

### Why Flat Planes Fail
The terrain mesh uses 128 segments over the terrain size (e.g., 12000 units = ~94 unit cells). Between terrain vertices, the GPU interpolates linearly, but `heightFn()` returns exact noise values. Any geometry sampling `heightFn` will disagree with the rendered terrain surface between grid points — causing features to clip in and out of the terrain.

### The safeHeight() Pattern (Required)
```typescript
function safeHeight(x: number, z: number, step: number): number {
  let maxH = -Infinity
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      maxH = Math.max(maxH, heightFn(x + dx * step, z + dz * step))
    }
  }
  return maxH + 8 // 8+ units above the max neighbor
}
```

### Construction Rules
1. **Build custom BufferGeometry** — each vertex samples `safeHeight(x, z, terrainCellSize)`
2. **Use 120+ segments** along the length for smooth terrain following
3. **Both edges of a strip share the same Y** per row — prevents twisting
4. **Y offset of 8+ units** above the max neighborhood sample
5. **No vertex shader displacement** on terrain-conforming geometry — it fights the conforming
6. **Use `depthWrite: false`** on the material to avoid z-fighting artifacts

## Procedural Shaders (Lava, Water, etc.)

### Anti-Patterns That Create "Bacon Stripes"
- All noise layers using the same `flowUV` (UV + linear time offset) — creates coherent horizontal bands
- `if/else` color ramp with hard thresholds — creates visible stripe boundaries
- Single noise function for the heat/intensity channel — too smooth, too directional

### Techniques That Produce Organic Results
1. **Domain warping (2 layers)** — use noise output to distort the UV coordinates fed to other noise layers. First warp feeds into second warp for extra turbulence
2. **Voronoi cellular noise** — `F2 - F1` distance creates irregular polygon-shaped plates with hot cracks between cells. Great for lava crust, ice cracks, dried mud
3. **Per-octave rotation in FBM** — `mat2(0.8, 0.6, -0.6, 0.8)` rotates ~37° each octave, prevents axis-aligned banding
4. **Overlapping smoothstep color ramp** — replace `if/else` with cascading `mix(color, nextColor, smoothstep(lo, hi, heat))` calls with overlapping ranges
5. **Crack-based heat** — Voronoi edge distance drives where hot material shows through cooled crust, plus subsurface turbulence visible through cracks

### Shader File Pattern
See `src/levels/environments/LavaShader.ts` for the full working example:
- `createLavaMaterial(flowSpeed, intensity)` factory returns a `ShaderMaterial`
- Caller drives `uTime` uniform in `useFrame`
- Two instances: rivers (flow 0.08, intensity 1.2) and volcano flows (flow 0.12, intensity 1.5)

## Workflow: Adding a New Level

### Biome Registration (all required)
1. `src/types/level.ts` — add to `BiomeType` union
2. `src/utils/terrainNoise.ts` — add noise config entry (frequency, amplitude, octaves, ridgeMode)
3. `src/levels/environments/BiomeEnvironment.tsx` — add entries to ALL of:
   - `BIOME_SETTINGS` (sun position, fog color, fog distances, sky scale)
   - `BIOME_COLOR_RAMPS` (terrain vertex colors by height/slope)
   - `BIOME_TERRAIN_CONFIGS` (segments, size)
   - Tree type in `BIOME_TREE_TYPES`
   - `getTreeCount()` case
   - Terrain size override if needed
   - Slope rejection angle
4. `src/levels/environments/BiomeDecorations.tsx` — add decoration case
5. `src/audio/MusicManager.ts` — add music config entry (tempo, chords, bass, lead, hasPerc)
6. `src/levels/LevelRegistry.ts` — add level definition (biome, waves, track config, nextLevel chain)

### Enemy Registration (all required)
1. `src/types/level.ts` — add to `EnemyType` union
2. `src/entities/enemies/SharedEnemyAssets.ts` — geometry + material singletons (with specular/iridescence)
3. `src/entities/enemies/NewEnemy.tsx` — R3F component using `<EnemyBase>` wrapper
4. `src/entities/spawning/EnemySpawner.tsx` — ALL of:
   - Import the component
   - Add score value to `ENEMY_SCORES`
   - Add collision radius to `ENEMY_RADII`
   - Add spawn positioning case (radius, height offset)
   - Add to `ENEMY_COMPONENTS` map

### Special Features (if needed)
- **Eruption/weather events**: Add `isEruption?: boolean` (or similar) to `EnemyWave`, emit via `eventBus` in spawner, listen in `BiomeEnvironment.tsx`
- **Terrain-conforming features**: Follow the safeHeight() pattern above
- **Custom shaders**: Create separate `*Shader.ts` file with `create*Material()` factory, drive uniforms in `useFrame`
- **Landmark components**: Create in `src/levels/environments/`, accept optional custom material props

## Common Pitfalls

| Symptom | Cause | Fix |
|---------|-------|-----|
| Enemies invisible | Scale too small (1-3x) | Use 8x minimum for small-geometry enemies |
| Enemies invisible | Colors match terrain | Ensure contrast with biome colors |
| Feature clips through terrain | Using flat PlaneGeometry | Build custom BufferGeometry with safeHeight() |
| Feature clips through terrain | Y offset too small | Use 8+ units above max 3x3 neighborhood |
| Decorations flicker/z-fight | Y offset < 1 unit | Use 3-8 unit offset above heightFn |
| Shader looks striped/"bacon" | All noise on same flowUV | Add domain warping + per-octave rotation |
| Shader bands visible | Hard if/else color ramp | Use overlapping smoothstep transitions |
| Landmark feels tiny | Undersized geometry | Double initial size estimate |
| Landmark feels disconnected | Placed too far (>3000) | Keep within ~2400 units of origin |
| Hexagonal stick geometry | height-via-scale trick | Bake height into CylinderGeometry constructor |
| Terrain holes/spikes | Missing noise config | Add entry to terrainNoise.ts |
| No music plays | Missing MusicManager entry | Add biome config to CONFIGS record |
| Enemies don't spawn | Missing spawner registration | Check all 4 spawner touchpoints |
