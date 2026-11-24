import type { ComponentType } from 'react'
import type * as THREE from 'three'
import type { HeightFunction } from '@/utils/terrainNoise'
import type { ArcTable } from '@/track/arcLength'
import type { RideSpeeds } from '@/track/ridePhysics'
import type { DarkSectionSpec, WhaleBreachSpec } from '@/types/level'
import type { Rng } from '@/utils/rng'
import type { AtmosphereConfig } from '../atmosphere'
import type { FogModifiers } from './sceneFog'
import type { KeepOff, PlacementBounds } from '@/entities/spawning/spawnPlacement'
import type { Vec3 } from '@/utils/vec3'
import type { HeroShot } from '@/track/introCamera.hot'

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
  /** Fraction of a tree's own colour added as unlit light, for biomes whose backlit trees go black next to bright ground (arctic). */
  fill?: number
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
  /** The ride's speeds (`rideModel`), for biome events timed on the ride (Ocean's whale). */
  speeds: RideSpeeds
  /** The level's whale breach (`environment.whale`), when it asks for one (Ocean's Features). */
  whale?: WhaleBreachSpec
  /** The track's dark sections (#752), for a biome that builds round one (Arctic's ice cave). */
  darkSections?: readonly DarkSectionSpec[]
  atmosphere: AtmosphereConfig
  /** The scene fog's modifiers, for biome events that pull it in (the volcanic eruption publishes `fog.eruption`). */
  fog: FogModifiers
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

/** A boost's rise / hold / fade alone: what `boostStrength` and `stepBoost` read (the weather pulse's too, `weatherPulse.ts`). */
export type BoostEnvelope = Pick<ParticleBoost, 'riseS' | 'holdS' | 'fadeS'>

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
  /** An authored floor in place of the noise terrain (an interior: the gym's hall and its pit; its terrain config is `authoredFloor`); no track suppression. Read through `groundOf` (`worlds.ts`). */
  floor?: HeightFunction
  /** An interior's walls and roof, inset: enemies are placed inside them, never behind a wall. */
  bounds?: PlacementBounds
  /** Landmarks and big props a ground enemy stood away from the track keeps out of (`spawnPlacement.ts` `whereTheApproachLooks`), and a swimmer's circle (`swimOrbit.ts`). */
  keepOff?: (groundFn: HeightFunction, track: ArcTable) => readonly KeepOff[]
  /** Moves an air enemy's placed spot out of the world's buildings (the city's towers, #323): scatter and formation alike. */
  clearAir?: (groundFn: HeightFunction, track: ArcTable) => (p: Vec3) => Vec3
  /** The hero landmark the intro's tour passes (#675) and the results orbit circles (#328). */
  hero: HeroShot
}
