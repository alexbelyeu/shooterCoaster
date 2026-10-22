import type { ArchConfig } from '../../RockArches'

/** Fixed desert landmarks, shared by Features (to draw them) and the layout (to keep clear of them). */

export const ARCHES: readonly ArchConfig[] = [
  { pos: [1200, 0, -400], rotY: 0.3, scale: 1.0 },
  { pos: [-1000, 0, 800], rotY: 1.5, scale: 0.85 },
  { pos: [600, 0, 1400], rotY: 2.8, scale: 1.15 },
  { pos: [-1400, 0, -600], rotY: 4.2, scale: 0.9 },
]

/** Half-span of an arch at scale 1: arch radius 120 + flared pillar 26. */
const ARCH_REACH = 146

/** Pyramid.tsx: 800-wide base, 8 layers of 80. */
export const PYRAMID = { x: 2000, z: -1600, reach: 570, height: 640 }

/** Circles (XZ) that mesas and dust devils stay out of. */
export const LANDMARK_FOOTPRINTS: readonly { x: number; z: number; r: number }[] = [
  { x: PYRAMID.x, z: PYRAMID.z, r: PYRAMID.reach },
  ...ARCHES.map((a) => ({ x: a.pos[0], z: a.pos[2], r: ARCH_REACH * a.scale })),
]
