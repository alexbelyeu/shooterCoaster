# Level 5: Volcanic — Design Spec

## Overview

A volcanic/lava biome serving as the climactic finale of ShooterCoaster. The largest, hardest, and longest level — featuring erupting volcanoes, molten lava rivers, fire elementals and demons, and periodic eruption events that shake the screen and flood the field with enemies.

---

## Level Config

```ts
{
  id: 'level5',
  name: 'Inferno',
  description: 'Descend into the volcanic depths',
  order: 5,
  biome: 'volcanic',
  maxScore: TBD,  // calculated from wave composition below
  timerSeconds: 120,  // longest level (6 waves)
  message: 'You conquered the Inferno!',
  nextLevel: null,  // final level
  starThresholds: [0.25, 0.55, 0.85],
  track: {
    varA: 3,
    varB: 40,
    varC: 5,
    scalar: 40,
    // Track max extent = 5 * 13 * 40 = 2600
    rollerSpeed: 0.000005,
    minRollerSpeed: 0.00005,
    curve: 'curve2',
    color1: 0x2a2a2a,   // dark iron gray
    color2: 0xff4400,   // molten orange accent
  },
  environment: {
    groundColor: 0x1a1210,
    skybox: 'inferno',  // new skybox needed
    hasTrees: true,
    treeCount: 60,       // charred dead trees
    hasWater: false,
  },
}
```

### Key Dimensions

| Metric | Value | Notes |
|--------|-------|-------|
| Track max extent | 2600 | `varC(5) * 13 * scalar(40)` |
| Enemy spawn radius | 2800 | ~1.1x track extent |
| Decoration scatter max | 5000 | ~2x track extent |
| Landmark distance | 3200 | Beyond track, within fog far |
| Fog far (base) | 6000 | Dynamic — drops to ~200 during eruptions |
| Terrain size | 12000 | Largest terrain plane |

---

## Biome Settings

```ts
volcanic: {
  sunPosition: [80, 30, -60],   // low sun, dramatic long shadows
  skyScale: 12000,
  ambientIntensity: 0.5,         // darker ambient — lit by lava glow
  dirIntensity: 0.7,
  fogColor: 0x3a1a0a,            // dark smoky red-brown
  fogNear: 1,
  fogFar: 6000,                  // base value — dynamic during eruptions
}
```

## Terrain Color Ramp

```ts
volcanic: {
  stops: [
    { height: 0.0, color: 0x1a0e08 },  // dark volcanic black (valleys)
    { height: 0.15, color: 0x2a1510 },  // dark charcoal-brown
    { height: 0.3, color: 0x3a2018 },   // warm dark brown
    { height: 0.5, color: 0x4a2a1a },   // burnt umber
    { height: 0.7, color: 0x3a2015 },   // darkening again
    { height: 0.85, color: 0x2a1810 },  // near-black peaks
    { height: 1.0, color: 0x1a1008 },   // obsidian black peaks
  ],
  cliffColor: 0x5a3020,               // exposed rock face — warm brown
}
```

## Terrain Noise Config

```ts
volcanic: {
  frequency: 0.0006,
  amplitude: 250,      // high amplitude — steep volcanic terrain
  octaves: 5,
  persistence: 0.5,
  lacunarity: 2.2,
}
```

---

## Enemy Types (4 new types)

All enemies use **bright, high-contrast colors** (orange/red emissive accents on dark bodies) to stand out against the dark volcanic terrain.

### 1. Ember Wisp (flying, common grunt)

- **Role**: Fast, small, swarming flier. Easiest to hit individually but appears in large numbers.
- **Geometry**: Small SphereGeometry core (radius 3) + 4-6 ConeGeometry flame tendrils radiating outward
- **Material**: MeshPhongMaterial — core `#ff6600` with emissive `#ff3300`; tendrils `#ffaa00` with transparency
- **Movement**: Erratic bobbing flight, `y = heightFn(x,z) + 60 + Math.random() * 140`. Sinusoidal drift in x/z.
- **Animation**: Core pulses scale (0.8-1.2), tendrils flicker rotation randomly
- **Score**: 12
- **Collision radius**: 35
- **Spawn radius**: 2800

### 2. Lava Golem (ground, medium)

- **Role**: Slow, hulking ground enemy. Terrain-following. Medium difficulty.
- **Geometry**: LatheGeometry body (bulky humanoid profile), SphereGeometry head, BoxGeometry arms
- **Material**: MeshPhongMaterial — body `#4a2a10` (dark rock) with specular `#ff6633`, shininess 50. Cracks/seams via second mesh layer in `#ff4400` emissive.
- **Movement**: Slow walk toward random direction, terrain-following via `TerrainContext`. Camera-facing.
- **Animation**: Arm sway (opposite phases), body wobble `rotation.z = sin(t*2) * 0.04`
- **Score**: 35
- **Collision radius**: 130
- **Spawn radius**: 2400

### 3. Fire Imp (ground, fast scout)

- **Role**: Small, quick ground enemy. Hard to hit. Darts erratically.
- **Geometry**: LatheGeometry body (small, hunched profile), ConeGeometry horns (2x), thin CylinderGeometry tail with spike
- **Material**: MeshPhysicalMaterial — `#8b1a1a` (dark red), metalness 0.2, roughness 0.5, iridescence 0.3. Horns: `#2a0808` dark.
- **Movement**: Fast ground movement with sudden direction changes every 2-3s. Terrain-following.
- **Animation**: Tail sway `rotation.y = sin(t*6) * 0.4`, body lean into movement direction
- **Score**: 18
- **Collision radius**: 55
- **Spawn radius**: 2200

### 4. Infernal Drake (flying, wave-ender elite)

- **Role**: Large, intimidating flying enemy. Appears in final waves. High score, big target.
- **Geometry**: Complex multi-part — LatheGeometry body (serpentine dragon profile), custom BufferGeometry wings (bat-like membrane, 4 wing segments), ConeGeometry head spikes (3-4), CylinderGeometry tail
- **Material**: MeshPhysicalMaterial — body `#2a0a0a` (near-black red), metalness 0.3, roughness 0.4, iridescence 0.5, iridescenceIOR 1.4. Wings: semi-transparent `#660000` with emissive `#ff2200` veins.
- **Movement**: Slow circling flight at high altitude `y = heightFn(x,z) + 150 + Math.random() * 100`. Gradual orbit.
- **Animation**: Multi-joint wing flap (inner leads at `sin(t*3)*0.6`, outer trails `sin(t*3+0.8)*0.5`), tail undulation, jaw open/close
- **Score**: 60
- **Collision radius**: 200
- **Spawn radius**: 2600

### EnemyType additions

```ts
// Add to types/level.ts
export type EnemyType = ... | 'emberWisp' | 'lavaGolem' | 'fireImp' | 'infernalDrake'
```

---

## Enemy Waves (6 waves)

```ts
enemies: [
  { type: 'emberWisp',     count: 35, spawnDelay: 0,  waveLabel: 'Embers Rise!' },
  { type: 'fireImp',       count: 25, spawnDelay: 15, waveLabel: 'Imps Attack!' },
  { type: 'lavaGolem',     count: 15, spawnDelay: 30, waveLabel: 'Golems Awaken!' },
  { type: 'emberWisp',     count: 40, spawnDelay: 50, waveLabel: 'Swarm!' },       // eruption event trigger
  { type: 'infernalDrake', count: 6,  spawnDelay: 70, waveLabel: 'Drakes Descend!' },
  { type: 'lavaGolem',     count: 10, spawnDelay: 85, waveLabel: 'Final Eruption!' }, // + mixed imps?
]
```

### Max Score Calculation

| Wave | Type | Count | Score Each | Subtotal |
|------|------|-------|------------|----------|
| 1 | emberWisp | 35 | 12 | 420 |
| 2 | fireImp | 25 | 18 | 450 |
| 3 | lavaGolem | 15 | 35 | 525 |
| 4 | emberWisp | 40 | 12 | 480 |
| 5 | infernalDrake | 6 | 60 | 360 |
| 6 | lavaGolem | 10 | 35 | 350 |
| **Total** | | **131** | | **2585** |

`maxScore: 2585`

---

## Decorations (BiomeDecorations.tsx)

All use InstancedMesh. Scatter radii extend to 5000 (2x track extent).

### 1. Obsidian Shards (150 instances)

- **Geometry**: ConeGeometry(2, 15, 4) — 4-sided for crystalline look. Random height 8-25, random lean.
- **Material**: MeshPhongMaterial — `#0a0a12` (near-black with blue tint), specular `#4466aa`, shininess 80
- **Scatter**: minR 100, maxR 5000
- **Placement**: On terrain surface, slight random rotation for variety

### 2. Lava Pools (30 instances)

- **Geometry**: CircleGeometry(12, 24) — flat on ground. Random radius 8-20.
- **Material**: MeshPhongMaterial — `#ff4400`, emissive `#ff2200`, emissiveIntensity 0.6, transparent, opacity 0.85
- **Scatter**: minR 200, maxR 4000
- **Placement**: At terrain height, face up (rotation.x = -PI/2). Only place where `heightFn < median` (in valleys/low areas)

### 3. Charred Trees (60 instances — also via tree system)

- **Geometry**: CylinderGeometry(1.5, 2.5, 30, 6) trunk + 3-4 CylinderGeometry(0.3, 0.1, 12, 4) branches at random angles
- **Material**: MeshPhongMaterial — `#1a1008` (charcoal black-brown), specular `#332211`, shininess 10
- **Tree system config**:
  ```ts
  case 'volcanic':
    return [{
      trunkColor: '#1a1008',
      canopyColors: () => '#1a1008',  // no canopy color distinction — all charred
      canopyGeoFactory: () => null,    // no canopy — bare branches only
      heightRange: [15, 50],
    }]
  ```
- **Scatter**: minR 100, maxR 4500
- **Slope rejection**: PI/6 (30 degrees — moderate, no trees on steep volcanic slopes)

### 4. Ember Patches (80 instances)

- **Geometry**: CircleGeometry(5, 16) — flat ground patches. Random radius 3-8.
- **Material**: MeshPhongMaterial — `#cc3300`, emissive `#ff4400`, emissiveIntensity 0.3, transparent, opacity 0.5
- **Scatter**: minR 50, maxR 4500
- **Placement**: At terrain height + 0.1, face up. Sprinkled everywhere for ambient glow.

### 5. Volcanic Boulders (60 instances)

- **Geometry**: DodecahedronGeometry(6) with random scale 0.5-2.0 per axis for organic variation
- **Material**: MeshPhongMaterial — `#2a1a10` (warm dark brown), specular `#443322`, shininess 20, flatShading true
- **Scatter**: minR 100, maxR 4500

---

## Landmark: Erupting Volcano

**Position**: `[3200, heightFn(3200, -1500), -1500]` — beyond track max extent (2600), within fog far (6000).

### Geometry

Multi-part composition:

1. **Mountain cone**: ConeGeometry(600, 800, 12) — large, low-poly volcanic cone
   - Material: MeshPhongMaterial `#2a1510`, specular `#443322`

2. **Crater rim**: TorusGeometry(80, 30, 8, 12) — sits on top of cone
   - Material: MeshPhongMaterial `#3a2018`

3. **Lava glow core**: SphereGeometry(60, 8, 8) — inside crater, visible glow
   - Material: MeshPhongMaterial `#ff4400`, emissive `#ff2200`, emissiveIntensity 0.8

4. **Lava flow strips**: 3-4 PlaneGeometry(20, 400) strips down the cone sides
   - Material: MeshPhongMaterial `#ff3300`, emissive `#ff1100`, emissiveIntensity 0.5, transparent, opacity 0.7
   - Rotated to follow cone surface angle

5. **Ash plume** (optional): Large SphereGeometry(200, 8, 6) above crater
   - Material: MeshPhongMaterial `#3a3030`, transparent, opacity 0.3

---

## Lava Rivers (Terrain Feature)

Emissive plane strips at low terrain elevations simulating molten channels.

### Implementation

```ts
// In BiomeEnvironment.tsx, after terrain creation
if (biome === 'volcanic') {
  // Create 4-6 lava river strips
  const riverGeo = new PlaneGeometry(30, 2000, 1, 20)
  const riverMat = new MeshPhongMaterial({
    color: '#ff4400',
    emissive: '#ff2200',
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.75,
    side: DoubleSide,
  })
  // Place at low elevation areas, rotate to follow terrain valleys
  // Rivers lie flat (rotation.x = -PI/2) at y = minTerrainHeight + 5
}
```

### Placement Rules

- Find terrain valleys (lowest 15% of height range)
- Orient rivers along valley directions
- 4-6 rivers, each 1500-2500 units long, 20-40 units wide
- Y position: just above minimum terrain height so they sit in valleys

---

## Eruption Events (Unique Mechanic)

Periodic volcanic eruption events that create gameplay intensity spikes.

### Behavior

1. **Trigger**: At wave 4 (`spawnDelay: 50`) and wave 6 (`spawnDelay: 85`)
2. **Visual effects**:
   - Screen shake (camera position oscillation, amplitude 2-5 units, duration 3s)
   - Fog distance drops from 6000 to 200 over 2s, then recovers to 6000 over 8s
   - Landmark volcano glow intensifies (emissiveIntensity pulses to 1.0)
3. **Gameplay effect**:
   - Enemy spawn burst: wave's enemies spawn in rapid succession (0.1s intervals vs normal 0.5s)
   - Creates a "wall of enemies" feeling during the eruption
4. **Duration**: ~10s total per eruption event

### Implementation Approach

- Add `isEruption` flag to wave config (boolean, optional)
- EnemySpawner checks flag and adjusts spawn interval
- BiomeEnvironment listens for eruption events via a shared state/context
- Camera shake via `useFrame` with damped sinusoidal offset
- Fog distance animated via `useFrame` lerp

---

## Music Config (MusicManager.ts)

```ts
volcanic: {
  key: 'D',
  mode: 'minor',           // dark, ominous
  tempo: 140,               // faster than arctic (120), building urgency
  instruments: {
    bass: 'FMSynth',        // deep rumbling bass
    lead: 'AMSynth',        // harsh, metallic lead
    pad: 'FMSynth',         // droning low pad
  },
  pattern: 'driving',       // relentless forward momentum
}
```

---

## Skybox

New skybox `'inferno'` — dark red-black gradient sky.

```ts
// Sky component settings
turbidity: 20,
rayleigh: 0.1,
mieCoefficient: 0.1,
mieDirectionalG: 0.8,
// Results in dark, hazy, red-tinted sky
```

---

## Performance Constraints

Given concerns about emissive materials and glow:

1. **Limit emissive objects**: Only lava pools (30), ember patches (80), lava rivers (6), and landmark glow use emissive. Total ~120 emissive elements.
2. **No post-processing bloom**: Emissive materials provide glow without bloom pass. Keep it simple.
3. **InstancedMesh for everything**: All decorations are instanced (5 draw calls total for decorations).
4. **Dynamic fog acts as culling**: During eruptions, close fog = fewer objects rendered = performance headroom exactly when the enemy count spikes.
5. **Enemy count cap**: 131 total enemies across 6 waves, similar to arctic's total. Density per wave is higher but total is manageable.

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/entities/enemies/EmberWisp.tsx` | Ember wisp enemy component |
| `src/entities/enemies/LavaGolem.tsx` | Lava golem enemy component |
| `src/entities/enemies/FireImp.tsx` | Fire imp enemy component |
| `src/entities/enemies/InfernalDrake.tsx` | Infernal drake enemy component |
| `src/levels/environments/Volcano.tsx` | Erupting volcano landmark component |

### Modified Files

| File | Changes |
|------|---------|
| `src/types/level.ts` | Add `'volcanic'` to BiomeType, add 4 enemy types to EnemyType |
| `src/levels/LevelRegistry.ts` | Add level5 config, update level4 `nextLevel` to `'level5'` |
| `src/entities/enemies/SharedEnemyAssets.ts` | Add geometries + materials for all 4 new enemy types |
| `src/entities/spawning/EnemySpawner.tsx` | Add spawn cases, scores, radii, components for 4 types |
| `src/levels/environments/BiomeEnvironment.tsx` | Add volcanic biome settings, color ramp, tree type, fog, landmark |
| `src/levels/environments/BiomeDecorations.tsx` | Add volcanic decoration case |
| `src/utils/terrainNoise.ts` | Add volcanic terrain noise config |
| `src/audio/MusicManager.ts` | Add volcanic music config |

---

## Implementation Order

1. Types + level config (foundation)
2. Terrain noise + biome environment settings (see the world)
3. Decorations (populate the world)
4. Landmark (visual anchor)
5. Enemy assets (geometries + materials)
6. Enemy components (behavior + animation)
7. Spawner registration (make enemies appear)
8. Lava rivers (terrain feature)
9. Eruption events (unique mechanic)
10. Music config
11. Polish pass (contrast, spacing, performance)
