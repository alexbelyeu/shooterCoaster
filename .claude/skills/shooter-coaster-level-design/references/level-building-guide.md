# ShooterCoaster Level Building Guide

Complete reference for building levels in the Three.js on-rails shooter coaster game. Covers track configuration, enemy design, decorations, landmarks, and spawn systems.

## Architecture Overview

### Key Files
- `src/levels/LevelRegistry.ts` — Level configs: track params, enemy waves, environment settings
- `src/entities/enemies/SharedEnemyAssets.ts` — All shared geometries and materials for enemies
- `src/entities/enemies/*.tsx` — Individual enemy components (one per enemy type)
- `src/entities/spawning/EnemySpawner.tsx` — Spawn logic, collision radii, score values
- `src/levels/environments/BiomeEnvironment.tsx` — Terrain, sky, fog, trees, landmark placement
- `src/levels/environments/BiomeDecorations.tsx` — Per-biome InstancedMesh decorations
- `src/levels/environments/*.tsx` — Individual landmark components (Pyramid, IceFortress, etc.)
- `src/canvas/SceneManager.tsx` — Passes level config to EnemySpawner and BiomeEnvironment

### Level Config Structure (LevelRegistry.ts)
```ts
{
  id: 'level2',
  name: 'Desert',
  biome: 'desert',
  maxScore: 25 * 15 + 20 * 30 + 8 * 50,  // sum of (count * score) per wave
  timerSeconds: 75,
  nextLevel: 'level3',
  track: {
    varA: 5, varB: 27, varC: 2, scalar: 60,  // curve shape + scale
    rollerSpeed: 0.000006, minRollerSpeed: 0.00006,
    curve: 'curve1',
    color1: 0xb8860b, color2: 0xdaa520,
  },
  enemies: [
    { type: 'scorpion', count: 30, spawnDelay: 0, waveLabel: 'Scorpions!' },
    { type: 'crow', count: 50, spawnDelay: 15, waveLabel: 'Crows!' },
  ],
  starThresholds: [0.2, 0.5, 0.8],
  environment: {
    groundColor: 0xd2a860,
    skybox: 'desert',
    hasTrees: true,     // optional
    treeCount: 80,      // optional
    hasWater: false,     // optional
  },
}
```

---

## Track Configuration

### The Scalar Problem
The `scalar` value multiplies ALL curve coordinates (x, y, z). A high scalar makes the coaster tower above terrain. The scalar must be balanced so the track altitude is proportional to the terrain and enemies.

**Reference values from working levels:**
| Level | Curve | Scalar | Feel |
|-------|-------|--------|------|
| Theme Park | curve1 | 60 | Moderate, close to ground |
| Desert | curve1 | 60 | Moderate |
| Ocean | curve2 | 20 | Low, near water |
| Antarctica | curve2 | 35 | Medium, through mountains |

### Track Max Extent Formula
The farthest point the track reaches from origin:
```
maxExtent = varC * 13 * scalar
```
Examples:
- Desert: 2 * 13 * 60 = 1560
- Ocean: 4 * 13 * 20 = 1040
- Arctic: 4 * 13 * 35 = 1820

This value is critical for:
- Placing landmarks BEYOND the track
- Setting spawn radii so content surrounds the track
- Ensuring decorations fill the visible area

---

## Enemy Design

### Geometry Principles

**Use `LatheGeometry` for organic body shapes.** Define a 2D profile of points and revolve it:
```ts
const bodyPoints = [
  new Vector2(0, 0),      // tail tip
  new Vector2(1.5, 1),    // tail base
  new Vector2(3, 3),      // body bulk
  new Vector2(2.5, 5),    // narrowing
  new Vector2(0.5, 6.5),  // neck
  new Vector2(0, 7),      // head
]
const bodyGeo = new LatheGeometry(bodyPoints, 10)
```
This produces far better results than capsules, spheres, or boxes for birds, fish, and similar creatures.

**Use custom `BufferGeometry` for flat appendages** (wings, fins, tails):
```ts
function makeWingGeo(pts: number[][]): THREE.BufferGeometry {
  const verts = new Float32Array(pts.flat())
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.computeVertexNormals()
  return geo
}
```

**NEVER use `CylinderGeometry(r, r, 1, N)` with `scale.set(1, height, 1)`.** This stretches a tiny cylinder, producing hexagonal sticks with wrong proportions. Instead, bake the full height into the geometry or use LatheGeometry with a proper profile.

### Material Principles

**Contrast with terrain.** Dark enemies on dark terrain = invisible. Pick colors that stand out:
- Desert enemies: warm amber/brown (not black)
- Ocean enemies: steel grey with specular (not dark blue)
- Arctic enemies: blue-white with specular (not pure white)

**Use specular for hard/shiny surfaces:**
```ts
new MeshPhongMaterial({
  color: '#6b4423',
  specular: '#aa8855',  // warm highlight
  shininess: 40,
  flatShading: true,
})
```
Good for: chitin, ice, wet skin, waxy plant surfaces, metallic objects.

**Use `MeshPhysicalMaterial` with iridescence for feathered/organic creatures:**
```ts
new MeshPhysicalMaterial({
  color: '#1a1a2e',
  metalness: 0.15,
  roughness: 0.6,
  iridescence: 0.4,
  iridescenceIOR: 1.3,
  iridescenceThicknessRange: [200, 400],
  flatShading: true,
})
```

### Behavior Patterns

**Ground enemies MUST follow terrain every frame.** Import `TerrainContext` and sample height:
```tsx
const heightFn = useContext(TerrainContext)
// In updatePosition callback:
mesh.position.y = heightFn(mesh.position.x, mesh.position.z) + offset
```
Without this, enemies clip through hills and float over valleys as they move.

**Camera-facing makes enemies more menacing.** Use `useFrame` + `useThree`:
```tsx
const camera = useThree((s) => s.camera)
const modelRef = useRef<THREE.Group>(null)

useFrame(() => {
  if (!modelRef.current?.parent) return
  const parent = modelRef.current.parent
  const dx = camera.position.x - parent.position.x
  const dz = camera.position.z - parent.position.z
  modelRef.current.rotation.y = Math.atan2(dx, dz)
})
```

**Animation gives enemies personality.** Examples of effective patterns:
- Multi-joint wing flap: inner wing leads (`sin(t*5)*0.5`), outer wing trails with phase delay (`sin(t*5+0.5)*0.4`)
- Body wobble/waddle: `rotation.z = sin(t*3) * 0.06`
- Arm sway: opposite phases on left/right arms
- Tail sway: `rotation.y = sin(t*4) * 0.3`
- Body pitch based on velocity: `rotation.x = clamp(vy * -0.15, -0.4, 0.4)`

### Enemy Component Structure
```tsx
export default function MyEnemy(props: EnemyProps) {
  const theta = useMemo(() => ..., [])
  const moveSpeed = useMemo(() => ..., [])
  const modelRef = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)
  const heightFn = useContext(TerrainContext)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      // Movement
      mesh.position.x += ...
      mesh.position.z += ...
      // Terrain following (ground enemies)
      mesh.position.y = heightFn(mesh.position.x, mesh.position.z) + offset
      // Animations
      ...
    },
    [theta, moveSpeed, heightFn],
  )

  // Camera facing
  useFrame(() => {
    if (!modelRef.current?.parent) return
    const parent = modelRef.current.parent
    const dx = camera.position.x - parent.position.x
    const dz = camera.position.z - parent.position.z
    modelRef.current.rotation.y = Math.atan2(dx, dz)
  })

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={modelRef} scale={[S, S, S]}>
        {/* meshes */}
      </group>
    </EnemyBase>
  )
}
```

---

## Spawn Configuration (EnemySpawner.tsx)

### Spawn Radius
Enemies spawn using `Math.sqrt(Math.random()) * range + minR` for uniform disc distribution. The range must cover the area where the track travels AND extend beyond it so content is visible in all directions.

**Rule of thumb:** max spawn radius should be ~1.2x the track max extent. Min radius should be ~100-200.

Example for a track with max extent 1820:
```ts
const r = Math.sqrt(Math.random()) * 2200 + 200  // 200 to 2400
```

### Height Assignment by Type
```ts
case 'groundEnemy':
  y = heightFn(x, z) + 5       // sits on terrain
case 'flyingEnemy':
  y = heightFn(x, z) + 100 + Math.random() * 160  // high above terrain
case 'waterEnemy':
  y = 2                         // water surface
```

### Score and Radii Tables
Each enemy type needs entries in three maps:
- `SCORES`: points awarded when destroyed
- `RADII`: collision detection radius (must match model scale)
- `COMPONENTS`: React component to render

---

## Decorations (BiomeDecorations.tsx)

### InstancedMesh Pattern
Each decoration type is an `InstancedMesh` — a single draw call for N instances. The pattern:
```tsx
const positions = useMemo(() => scatterPositions(count, minR, maxR, heightFn), [heightFn])
const geo = useMemo(() => new THREE.SomeGeometry(...), [])
const mat = useMemo(() => new THREE.SomeMaterial(...), [])

const setRef = useCallback((mesh: InstancedMesh | null) => {
  if (!mesh) return
  const mat4 = new THREE.Matrix4()
  for (let i = 0; i < positions.length; i++) {
    // Set position, rotation, scale per instance
    mat4.compose(position, quaternion, scale)
    mesh.setMatrixAt(i, mat4)
  }
  mesh.instanceMatrix.needsUpdate = true
}, [positions])

return <instancedMesh ref={setRef} args={[geo, mat, positions.length]} frustumCulled />
```

### Critical: Paired Callbacks Need Shared Config
When two InstancedMesh use the same per-instance random values (e.g., a trunk and its cap), **pre-compute the config array in useMemo**:
```ts
const configs = useMemo(() =>
  positions.map(() => ({
    height: 30 + Math.random() * 40,
    radius: 3 + Math.random() * 2,
  })),
  [positions]
)
```
Without this, `Math.random()` in separate callbacks produces different values, causing misaligned parts (gaps between body and cap, mismatched sizes).

### Scatter Radii
Decorations must fill the ENTIRE visible landscape — not just the center. When the track loops outward, looking away from center should still show content.

**Rule:** Max scatter radius should be ~2x track max extent, capped by fog distance.

### Multi-Type Systems
Split a decoration budget into multiple types for visual variety:
- Desert: 40 saguaro + 50 barrel + 60 columnar cacti (was 150 identical cylinders)
- Arctic: 140 ice crystals + 80 boulders + 45 columns + 20 ponds + 40 mounds

Each type is a separate InstancedMesh (1 draw call each), so 10 types = 10 draw calls total. Trivial performance cost.

### Geometry Tips for Decorations
- LatheGeometry with ribbed profiles for organic shapes (cactus, ice columns)
- `CircleGeometry` needs 24+ segments to look round (8 segments = visible octagon)
- `SphereGeometry` with partial `phiLength` for domes/half-spheres
- Slope rejection for tree placement — tighter for mountainous biomes:
  ```ts
  const maxSlope = biome === 'arctic' ? Math.PI / 8 : Math.PI / 4
  ```

---

## Landmarks

### Placement Rule
Landmarks must be placed **beyond the track max extent** but **within the fog far distance**.

```
trackMaxExtent < landmarkDistance < fogFar
```

Example: Track max 1820, fog far 5500 → place landmark at distance ~2500.

### Geometry
Same rule as everywhere: **never use height-via-scale tricks on towers/pillars**. Bake the full height into the geometry:
```ts
// BAD:
const geo = new CylinderGeometry(15, 18, 1, 6)
<mesh geometry={geo} scale={[1, 120, 1]} />  // stretched hexagonal stick

// GOOD:
const geo = new CylinderGeometry(15, 18, 120, 8)
<mesh geometry={geo} />  // proper cylinder
```

---

## Trees (BiomeEnvironment.tsx)

### Adding Trees to a Biome
1. Add tree type in `getTreeTypes()`:
```ts
case 'myBiome':
  return [{
    trunkColor: '#5c3a1e',
    canopyColors: () => `hsl(${hue}, ${sat}%, ${light}%)`,
    canopyGeoFactory: () => new THREE.ConeGeometry(1, 1, 6),
    heightRange: [25, 70],
  }]
```
2. Update `getTreeCount()` to allow the desired count
3. Set `hasTrees: true, treeCount: N` in level config environment

Trees auto-place on terrain with slope rejection and biome-specific filtering.

---

## Per-Biome Feature Toggles

Use props/config to control features per biome:
- `goldenBalloonCount`: Only theme park gets golden balloons (pass 0 for other biomes)
- `hasTrees` + `treeCount`: Per-biome tree density
- `hasWater`: Ocean biome only

---

## Common Pitfalls

1. **Track scalar too high** → coaster towers above everything. Compare with working levels before choosing.
2. **Height-via-scale trick** → hexagonal sticks with wrong proportions. Bake height into geometry.
3. **Random values in separate callbacks** → misaligned paired meshes. Pre-compute in useMemo arrays.
4. **Content clustered at center** → empty outer track sections. Extend scatter radii beyond track extent.
5. **Enemies without terrain-following** → clipping through hills. Use TerrainContext every frame.
6. **Low-contrast materials** → invisible enemies. Always check color against biome terrain colors.
7. **Flat MeshPhongMaterial with no specular** → looks like matte plastic. Add specular highlights.
8. **Low segment count on circles/cylinders** → visible polygon edges. Use 10+ radial segments.
9. **Landmarks inside track path** → coaster clips through them. Calculate track max extent first.
10. **Flying trees** → trees on cliff edges where terrain drops away. Tighten slope rejection.
