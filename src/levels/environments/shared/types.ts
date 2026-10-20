import type { ComponentType, RefObject } from 'react'
import type * as THREE from 'three'
import type { HeightFunction, TrackSample } from '@/utils/terrainNoise'
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
  canopyColors: () => string
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
  /** Terrain height as drawn (createTerrainSurface): sit grounded props on this. */
  groundFn: HeightFunction
  /** Pre-sampled track path, for scattering props around the ride (shared/trackScatter.ts). */
  trackSamples: TrackSample[]
}

/** Props every biome's features component (landmarks, terrain features, events) receives. */
export interface BiomeFeaturesProps {
  heightFn: HeightFunction
  atmosphere: AtmosphereConfig
  /** The scene fog, for biome events that animate it (volcanic eruption). */
  fogRef: RefObject<THREE.Fog | null>
}

/**
 * Everything BiomeEnvironment needs to render a biome. Sky/light/fog/exposure
 * stay in `atmosphere.ts`; terrain noise stays in `utils/terrainNoise.ts`.
 * Rendered in order: terrain, (water), trees, Decorations, Features.
 */
export interface BiomeDefinition {
  colorRamp: ColorRamp
  /** null = this biome never has trees. */
  trees: BiomeTreeConfig | null
  /** Scattered InstancedMesh props (cacti, coral, crystals…). */
  Decorations?: ComponentType<BiomeDecorationsProps>
  /** Landmarks, terrain-conforming features and biome events. */
  Features?: ComponentType<BiomeFeaturesProps>
}
