import * as THREE from 'three'
import type { ColorRamp } from '@/levels/environments/shared/types'

// Neon Metropolis (#323): a flat city at night. The ground is asphalt (the street grid comes from `cityShaders.ts`).

export const COLOR_RAMP: ColorRamp = {
  stops: [
    { height: 0.0, color: new THREE.Color(0x24222c) }, // asphalt
    { height: 0.5, color: new THREE.Color(0x2c2a34) },
    { height: 1.0, color: new THREE.Color(0x34303c) }, // the low swell beyond the skyline
  ],
  cliffColor: new THREE.Color(0x2a2832),
}

/**
 * Where the hero tower stands (`Features.tsx`), the intro's tour passes and the results orbit looks: in its plaza in the
 * city's north-west, the ride's helix wound round it (`cityTrack.ts`).
 */
export const LANDMARK_SITE = { x: -840, z: -600 } as const

/** Height of the hero tower (world units): the tallest thing in the city. */
export const SPIRE_HEIGHT = 820

/**
 * The elevated train line (#871): a viaduct along the street at `z`, from `from` to `to` along x, its deck's underside
 * `under` over the ground, pillars `pillarEvery` apart on the block centres (so the cross streets stay open). The ride
 * passes under it, the near miss (`cityTrack.ts`). A train of `cars` stands on it over the crossing at `trainX`.
 */
export const ELEVATED_LINE = {
  z: -600,
  from: 120,
  to: 1700,
  under: 40,
  deck: 6,
  width: 18,
  pillar: 6,
  pillarEvery: 240,
  trainX: 600,
  cars: 4,
  car: { length: 46, height: 11, width: 12, gap: 3 },
} as const

/** The towers the ride is built round (#871): the lift's tower and the two either side of the first drop. */
export const RIDE_TOWERS = [
  { x: -240, z: -240, w: 170, d: 170, h: 380 },
  { x: 240, z: -480, w: 170, d: 170, h: 430 },
  { x: 240, z: -240, w: 170, d: 170, h: 400 },
] as const
