import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { BiomeTreeConfig, ColorRamp } from '@/levels/environments/shared/types'
import { BIOME_TERRAIN_CONFIGS, type NoiseTerrainConfig } from '@/utils/terrainNoise'

// Jungle Ruins (level8, #870): wooded hills steaming under a hazy sun, the ride in the valleys between them, a stepped
// temple and a waterfall on terraces cut into the hills ahead of the first drop.

export const COLOR_RAMP: ColorRamp = {
  stops: [
    { height: 0.0, color: new THREE.Color(0x2f4a1c) }, // valley floor: wet leaf litter
    { height: 0.25, color: new THREE.Color(0x3d6324) }, // undergrowth
    { height: 0.55, color: new THREE.Color(0x2d5a26) }, // forested slopes
    { height: 0.85, color: new THREE.Color(0x4c6a3a) }, // hilltops
    { height: 1.0, color: new THREE.Color(0x6a7a52) }, // mossy crowns
  ],
  cliffColor: new THREE.Color(0x5a5844),
}

/** An emergent tree's crown: a broad, flat-topped umbrella of leaf clumps (unit height, about two wide). */
function umbrellaCrown(): THREE.BufferGeometry {
  const clumps = [
    [0, 0.15, 0, 1],
    [0.55, 0, 0.2, 0.7],
    [-0.5, 0.02, 0.3, 0.65],
    [0.1, -0.02, -0.6, 0.7],
    [-0.35, 0.08, -0.4, 0.6],
  ].map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 0).scale(1, 0.45, 1).translate(x, y, z))
  const crown = mergeGeometries(clumps)
  clumps.forEach((g) => g.dispose())
  return crown.scale(0.75, 1, 0.75)
}

export const TREES: BiomeTreeConfig = {
  types: [
    // Emergents: tall, their flat crowns over the rest
    {
      trunkColor: '#6b5a44',
      canopyColors: (rng) => `hsl(${rng.range(88, 118)}, ${rng.range(45, 62)}%, ${rng.range(24, 34)}%)`,
      canopyGeoFactory: umbrellaCrown,
      heightRange: [65, 95],
    },
    // The canopy layer: dense round crowns, darker and bluer
    {
      trunkColor: '#4a3a28',
      canopyColors: (rng) => `hsl(${rng.range(110, 140)}, ${rng.range(40, 58)}%, ${rng.range(18, 27)}%)`,
      canopyGeoFactory: () => new THREE.DodecahedronGeometry(1, 0),
      heightRange: [38, 62],
    },
  ],
  maxCount: 900,
  minRadius: 120,
  maxRadius: 3000,
  maxSlope: Math.PI / 3,
  fill: 0.12,
}

const TERRACES = (BIOME_TERRAIN_CONFIGS.jungle as NoiseTerrainConfig).terraces!

/** The stepped temple, the hero landmark (`templeGeometry.ts`): on its terrace, its stair turned to face the ride. */
export const TEMPLE = {
  x: TERRACES[0].x,
  z: TERRACES[0].z,
  ground: TERRACES[0].y,
  /** Half the bottom tier's width. */
  base: 330,
  tiers: 7,
  tierHeight: 52,
  /** Turned so the stair (+z of the model) faces the origin. */
  yaw: Math.atan2(-TERRACES[0].x, -TERRACES[0].z),
} as const

/** The temple's whole height, its shrine included. */
export const TEMPLE_HEIGHT = TEMPLE.tiers * TEMPLE.tierHeight + 110

/** The waterfall: a cliff on the hills right of the temple, its fall into a pool on the second terrace. */
export const FALLS = {
  x: TERRACES[1].x,
  z: TERRACES[1].z,
  ground: TERRACES[1].y,
  /** The lip's height over the pool. */
  drop: 340,
  width: 120,
  /** The cliff stands behind the pool, away from the ride. */
  yaw: Math.atan2(-TERRACES[1].x, -TERRACES[1].z),
} as const
