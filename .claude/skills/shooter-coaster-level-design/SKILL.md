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
5. **Enemy colors must contrast with terrain** — dark-on-dark = invisible. Keep base colours ΔE ≥ ~15 from the biome's terrain ramp, and wrap every lit enemy material in `withRim()` (`enemyRim.ts`: fresnel rim + reduced fog)
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
| `src/entities/spawning/spawnPlacement.ts` | Formation waves (`formation: 'v' \| 'line' \| 'school' \| 'spiral' \| 'ring'` on an `EnemyWave`): seeded slots at load, anchored ahead of the rider at activation, kept on / above `groundFn` and outside the 40-unit near field, with an entry path. An enemy that moves on its own should honour the `heading` prop so its group keeps its shape (see `Crow.tsx`) |
| `src/levels/environments/BiomeEnvironment.tsx` | Thin host: atmosphere, terrain mesh, water, trees, then the biome's `Decorations` + `Features`. No per-biome code here |
| `src/levels/environments/biomeRegistry.ts` | `BIOMES: Record<BiomeType, BiomeDefinition>` — one entry per biome |
| `src/levels/environments/biomes/themePark/layout.ts` | Worked example of track-aware placement: stalls along the track, string lights, bunting and an arch across it, all pure and unit-tested against the real track (`layout.test.ts`) |
| `src/levels/environments/biomes/<biome>/` | Per-biome module: `config.ts` (terrain `COLOR_RAMP`, `TREES` config), `Decorations.tsx` (InstancedMesh scatter), `Features.tsx` (landmarks, terrain features, events), `index.ts` (the `BiomeDefinition`) |
| `src/levels/environments/shared/` | Biome-agnostic helpers: `types.ts` (`BiomeDefinition`), `terrainMesh.ts` (terrain builder + colour-ramp sampler), `TreeField.tsx` + `treeWind.ts` (instanced trees; their materials sway in gusts via `withTreeWind`, so tree instance matrices must stay translate + scale, never rotated), `OceanWater.tsx` (water shader) + `waterWaves.ts` (its wave GLSL: anything floating on the water, like `biomes/ocean` foam rings, must use it), `StaticInstances.tsx` (InstancedMesh from precomputed matrices), `Atmosphere.tsx` (sky/lights/fog/env-map wiring), `scatter.ts` (`scatterPositions(createRng(<fixed seed>), …)`, `hslToRgb`; all layout randomness comes from `@/utils/rng` with a fixed seed so the world is identical every visit, never `Math.random`), `trackScatter.ts` (`scatterNearTrack` biases props toward the ride; `settleOnGround` sits them on the drawn terrain with no floating edge — see `biomes/arctic/IceCrystals.tsx`), `safeHeight.ts`, `trackClearance.ts` (`buildTrackIndex`: is anything of the track within r in XZ? — towers reach the ground, so test 2D), `paintedParts.ts` (vertex-coloured parts merged into one geometry), `ringedRock.ts` (`buildRingedRock`: a rock as a stack of jittered rings, banded vertex colours, pointed or flat cap — sea stacks, mesas), `ContactShadows.tsx` + `contactShadows.ts` (soft contact shadows: call `useContactShadows(useMemo(() => casters, …))` with a prop's footprint and it joins the level's one shadow mesh, terrain-following, no z-fighting), `ParticleField.tsx` (ambient particles wrapping around the camera, one draw call, half the points on touch; set as `BiomeDefinition.particles` from `particlePresets.ts`, whose test bounds keep every field subtle; a point's layer never changes, so a `boost` fades extra points in and out instead of moving any), `noiseGlsl.ts` (`gradientNoiseGlsl`: gnoise / voronoi / `fbm` with an `FBM_OCTAVES` define, used by lava and smoke; `valueNoiseGlsl`: sin-free `hash` / `vnoise` for the sky and aurora, which keep their own fbm). A `BiomeDefinition` can set `terrainGlow` to bake emissive ground (volcanic: beside the lava rivers); it applies to the default terrain material only. `BiomeDefinition.createTerrainMaterial` swaps the terrain material (keep `vertexColors`; see `biomes/desert/sandRipples.ts` for an `onBeforeCompile` patch — terrain vertex colours are linear-space, so hue masks must use linear ratios; a custom material ignores `terrainGlow`). Decorations and Features both receive `heightFn`, `groundFn` (terrain as drawn) and `track` (the dense `ArcTable`, the only track input); Features also get `atmosphere` and `fogRef` |
| `src/levels/environments/atmosphere.ts` | Per-biome sky/sun/hemisphere/fog config and post colour `grade` (`ATMOSPHERES`; the grade is applied by `src/canvas/post/ColourGradeEffect.ts`) |
| `src/levels/environments/SkyDome.tsx` | Procedural sky dome shader (gradient, sun, fbm clouds), follows camera |
| `src/levels/environments/LavaShader.ts` | Procedural GLSL lava material (domain warping + Voronoi) |
| `src/levels/environments/Volcano.tsx` | Volcano landmark component; shapes in pure `volcanoGeometry.ts` (rock + rim with a baked `glow` attribute, lava streaks) |
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
| Exception | Snowman (geometry already large) | 1.3x (scout 0.9x, brute 1.8x) |

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
Use the shared helper in `src/levels/environments/shared/safeHeight.ts` (max of a
3x3 neighbourhood ±`half` around the point, plus `yOffset`):
```typescript
import { safeHeight } from '../../shared/safeHeight'
const y = safeHeight(heightFn, x, z, TERRAIN_CELL * 0.6, 8) // 8+ units above the max neighbor
```
See `biomes/volcanic/lavaRivers.ts` for the full working example.

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
- Two instances: rivers (flow 0.08, intensity 1.7) and volcano streaks (flow 0.12, intensity 1.8)
- **UVs: `uv.x` 0..1 across the strip, `uv.y` = distance along it in strip widths** (see `lavaRivers.ts`, `volcanoGeometry.ts`). A 0..1 `uv.y` over a long strip stretches the crust cells into one bright line that aliases into a dotted yellow streak
- Far away the shader fades its cracks to an average heat (`fwidth`), so distant lava is a solid orange band instead of sparkle

## Workflow: Adding a New Level

### Biome Registration (all required)
1. `src/types/level.ts` — add to `BiomeType` union
2. `src/utils/terrainNoise.ts` — add a `BIOME_TERRAIN_CONFIGS` entry (frequency, amplitude, octaves, ridgeMode, baseY, flatRadius)
   (terrain mesh size override, if needed, is `getTerrainMeshSize` in the same file)
3. `src/levels/environments/biomes/<biome>/` — new folder (copy the closest existing biome):
   - `config.ts` — `COLOR_RAMP` (terrain vertex colours by height + `cliffColor` on slopes)
     and `TREES` (`BiomeTreeConfig`: tree types, `maxCount` cap, scatter radii, slope
     rejection angle — `PI/6` for mountains, `PI/4` for flat biomes; `null` = no trees)
   - `Decorations.tsx` — InstancedMesh scatter (gets `heightFn`, `groundFn`, `track`;
     use `shared/trackScatter.ts` to frame the ride or `shared/scatter.ts` for open
     ground, and `shared/trackClearance.ts` to stay off the track); dispose every
     geometry/material in a `useEffect` cleanup
   - `Features.tsx` — landmarks, terrain-conforming features, biome events (gets
     `heightFn`, `groundFn`, `track`, `atmosphere`, `fogRef`)
   - `index.ts` — export the `BiomeDefinition`; set `particles` to a preset from
     `shared/particlePresets.ts` (add one there for a new biome: two layers, counts,
     sizes and alphas inside the bounds its test checks; `boost` ties a burst of extra
     points to a bus event, like the volcano's `eruption:start` embers). `BiomeEnvironment`
     renders it; never mount a `ParticleField` by hand in `Features.tsx`
   Keep each file under ~400 lines; split big decoration sets into sibling components.
3b. `src/levels/environments/biomeRegistry.ts` — add the biome to `BIOMES` (the
   `Record<BiomeType, …>` type makes a missing entry a compile error).
3c. `src/levels/environments/atmosphere.ts` — add an `ATMOSPHERES` entry: sky dome
   gradient (zenith/horizon/ground), sun disc/glow, clouds, sun light, hemisphere
   light, fog near/far, `envIntensity`, and a colour `grade` (exposure, white balance,
   shadow/highlight tints, contrast, saturation, vignette) that sets the biome's mood.
   Fog colour is always `sky.horizon`.
4. (Nothing to add to `BiomeEnvironment.tsx` — it renders whatever the registry entry defines.)
5. `src/audio/MusicManager.ts` — add music config entry (tempo, chords, bass, lead, hasPerc)
6. `src/levels/LevelRegistry.ts` — add level definition (biome, waves, track config, nextLevel chain)
   and, optionally, `combat` (`bulletColor` / `bulletSize`, read by `SceneManager`; never
   special-case a level id in scene code)

### Enemy Registration (all required)
1. `src/types/level.ts` — add to `EnemyType` union
2. `src/entities/enemies/SharedEnemyAssets.ts` — geometry + material singletons (with specular/iridescence)
3. `src/entities/enemies/NewEnemy.tsx` — R3F component using `<EnemyBase>` wrapper
4. `src/entities/enemies/enemyReadability.ts` — add `ENEMY_SILHOUETTE` (world-unit size after scale; drives the ≥12 px readable-spawn rule)
5. `src/entities/spawning/EnemySpawner.tsx` — ALL of:
   - Import the component
   - Add score value to `ENEMY_SCORES`
   - Add collision radius to `ENEMY_RADII`
   - Add a spawn positioning case in `pickSpawn` (radius, height offset), or, for a ground enemy that should stand beside the ride, list it in `placedBesideTrack` (`spawnPlacement.ts`: seeded slots 700–2200 arc units ahead of the rider, 60–400 to the side, placed on `groundFn` when the wave activates)
   - Add to `ENEMY_COMPONENTS` map

### Special Features (if needed)
- **Eruption/weather events**: Add `isEruption?: boolean` (or similar) to `EnemyWave`, emit via `eventBus` in spawner, listen in the biome's `Features.tsx` (see `biomes/volcanic/Features.tsx`)
- **World-event shake**: `eventBus.emit(CAMERA_TRAUMA_EVENT, amount, durationMs)` (`src/combat/screenShake.ts`); it is rotation-only trauma. Never write `camera.position` (the smoke fails any translation off the track pose)
- **Terrain-conforming features**: Follow the safeHeight() pattern above
- **Custom shaders**: Create separate `*Shader.ts` file with `create*Material()` factory, drive uniforms in `useFrame`
- **Landmark components**: Create in `src/levels/environments/` (render them from the biome's `Features.tsx`), accept optional custom material props

## Common Pitfalls

| Symptom | Cause | Fix |
|---------|-------|-----|
| Enemies invisible | Scale too small (1-3x) | Use 8x minimum for small-geometry enemies |
| Enemies invisible | Colors match terrain | Ensure contrast with biome colors |
| Enemies read as grey blobs | Biome lighting too dim for the albedo | Emissive lift in the shadow tint + `withRim()`; check the `<level>-enemy.png` smoke close-up |
| Feature clips through terrain | Using flat PlaneGeometry | Build custom BufferGeometry with safeHeight() |
| Feature clips through terrain | Y offset too small | Use 8+ units above max 3x3 neighborhood |
| Decorations flicker/z-fight | Y offset < 1 unit | Use 3-8 unit offset above heightFn |
| Shader looks striped/"bacon" | All noise on same flowUV | Add domain warping + per-octave rotation |
| Shader bands visible | Hard if/else color ramp | Use overlapping smoothstep transitions |
| Landmark feels tiny | Undersized geometry | Double initial size estimate |
| Landmark feels disconnected | Placed too far (>3000) | Keep within ~2400 units of origin |
| Hexagonal stick geometry | height-via-scale trick | Bake height into CylinderGeometry constructor |
| Grounded object floats / sinks on ridged terrain | Placed on `heightFn`, but the drawn mesh is linear between grid vertices (up to ~55 units off on Arctic) | Sample `createTerrainSurface(heightFn, getTerrainMeshSize(biome))` for things that must touch the visible ground (see `src/track/supportTowers.ts`) |
| Prop or ride intersects the track or a support tower | Placed by radius from the origin, ignoring the track | Plan positions against `buildTrackIndex(track)` (2D clearance) and unit-test them, as `themePark/layout.test.ts` does |
| Level blows its draw-call budget | One `<mesh>` per prop part (a Ferris wheel was 88 draws) | InstancedMesh per part, or `paintedParts.ts` to merge a multi-coloured prop into one geometry |
| Terrain holes/spikes | Missing noise config | Add entry to terrainNoise.ts |
| No music plays | Missing MusicManager entry | Add biome config to CONFIGS record |
| Enemies don't spawn | Missing spawner registration | Check all 4 spawner touchpoints |
