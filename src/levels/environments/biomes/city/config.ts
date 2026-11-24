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

/** Block pitch and street width (world units): the asphalt shader paints the same grid. */
export const STREET_GRID = { pitch: 240, street: 64 } as const

/**
 * Where the hero tower stands (`Features.tsx`), the intro's tour passes and the results orbit looks: in its plaza in the
 * city's north-west, the ride's helix wound round it (`cityTrack.ts`).
 */
export const LANDMARK_SITE = { x: -840, z: -600 } as const

/** Height of the hero tower (world units): the tallest thing in the city. */
export const SPIRE_HEIGHT = 820

/**
 * The intro's landmark pass and the results orbit round the hero tower. The orbit (700 out) and the pass (×1.3) cross
 * the ride's blocks, so they fly over the tallest tower class (480, `cityLayout.ts`) rather than through it (#966).
 */
export const HERO_SHOT = { x: LANDMARK_SITE.x, z: LANDMARK_SITE.z, focus: SPIRE_HEIGHT * 0.45, orbitRadius: 700, orbitHeight: 540 } as const

/** The towers the ride is built round (#871): the lift's tower and the two either side of the first drop. */
export const RIDE_TOWERS = [
  { x: -240, z: -240, w: 170, d: 170, h: 380 },
  { x: 240, z: -480, w: 170, d: 170, h: 430 },
  { x: 240, z: -240, w: 170, d: 170, h: 400 },
] as const
