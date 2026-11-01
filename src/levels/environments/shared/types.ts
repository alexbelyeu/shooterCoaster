import type { ComponentType, RefObject } from 'react'
import type * as THREE from 'three'
import type { HeightFunction } from '@/utils/terrainNoise'
import type { ArcTable } from '@/track/arcLength'
import type { Rng } from '@/utils/rng'
import type { AtmosphereConfig } from '../atmosphere'

/** One stop of a terrain colour ramp. */
export interface ColorStop {
  height: number // normalized height 0-1
  color: THREE.Color
}

/** Terrain vertex colours: height ramp + colour blended in on steep slopes. */
export interface ColorRamp {
  stops: ColorStop[]
  cliffColor: THREE.Color
}

/** One instanced tree species (trunk + canopy). */
export interface TreeTypeConfig {
  trunkColor: string
  canopyColors: (rng: Rng) => string
  canopyGeoFactory: () => THREE.BufferGeometry
  heightRange: [number, number]
}

/** How a biome scatters trees over its terrain (see shared/TreeField.tsx). */
export interface BiomeTreeConfig {
  types: TreeTypeConfig[]
  /** Cap on the level's requested `treeCount` (undefined = no cap). */
  maxCount?: number
  /** Annulus the trees are scattered in. */
  minRadius: number
  maxRadius: number
  /** Slope rejection angle in radians (PI/6 for mountains, PI/4 for flat biomes). */
  maxSlope: number
}

/** Props every biome's decorations component receives. */
export interface BiomeDecorationsProps {
  heightFn: HeightFunction
  /** Terrain as drawn (`createTerrainSurface`): stand grounded props on this. */
  groundFn: HeightFunction
  /** The level's only track input: use with `shared/trackClearance.ts` and `shared/trackScatter.ts`. */
  track: ArcTable
  atmosphere: AtmosphereConfig
}

/** Props every biome's features component (landmarks, terrain features, events) receives. */
export interface BiomeFeaturesProps {
  heightFn: HeightFunction
  groundFn: HeightFunction
  track: ArcTable
  atmosphere: AtmosphereConfig
  /** The scene fog, for biome events that animate it (volcanic eruption). */
  fogRef: RefObject<THREE.Fog | null>
}

/** Ground that gives off its own light (volcanic: beside the lava), baked per terrain vertex. */
export interface TerrainGlow {
  color: THREE.ColorRepresentation
  intensity: number
  /** 0..1 at world (x, z), sampled once per terrain vertex. */
  sample: (x: number, z: number) => number
}

/** One kind of particle in a field (ash, embers, snowflakes, dust…). */
export interface ParticleLayer {
  /** sRGB hex. */
  color: number
  opacity: number
  /** Diameter in world units; on screen it is clamped to [1, maxPixels]. */
  size: number
  maxPixels: number
  /** Drift in world units per second (each point varies it ±30%). */
  velocity: [number, number, number]
  sway: number
  /** 0 = steady, 1 = strong flicker. */
  flicker: number
  /** Adds light (embers, plankton) instead of covering what is behind it (ash, dust). */
  additive: boolean
}

/** A burst of extra secondary-layer points that fade in when a bus event fires (volcanic eruption embers). */
export interface ParticleBoost {
  event: string
  /** Extra points, hidden until the event: they fade in and out, so no point ever changes layer. */
  count: number
  /** Seconds: linear fade in, at full strength, linear fade out (no point pops in or out). */
  riseS: number
  holdS: number
  fadeS: number
}

/** Ambient particles wrapping in a box around the camera (`shared/ParticleField.tsx`, presets in `shared/particlePresets.ts`). */
export interface ParticleFieldPreset {
  count: number
  /** Box around the camera the points wrap inside, world units. */
  box: [number, number, number]
  primary: ParticleLayer
  secondary: ParticleLayer
  /** Share of `count` drawn as the secondary layer. */
  secondaryShare: number
  boost?: ParticleBoost
}

/**
 * Everything BiomeEnvironment needs to render a biome. Sky/light/fog/grade
 * stay in `atmosphere.ts`; terrain noise stays in `utils/terrainNoise.ts`.
 * Rendered in order: terrain, (water), trees, Decorations, Features, particles.
 */
export interface BiomeDefinition {
  colorRamp: ColorRamp
  terrainGlow?: TerrainGlow
  /** null = this biome never has trees. */
  trees: BiomeTreeConfig | null
  /** Terrain material (must use vertex colours); default: flat-shaded vertex-coloured Phong with `terrainGlow` applied. A custom material ignores `terrainGlow`. */
  createTerrainMaterial?: () => THREE.Material
  /** Scattered InstancedMesh props (cacti, coral, crystals…). */
  Decorations?: ComponentType<BiomeDecorationsProps>
  /** Landmarks, terrain-conforming features and biome events. */
  Features?: ComponentType<BiomeFeaturesProps>
  /** Ambient air particles around the camera (one draw call). */
  particles?: ParticleFieldPreset
}
