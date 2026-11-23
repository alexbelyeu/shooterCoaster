import { ARCH_REACH, type ArchConfig, PYRAMID_LAYER_HEIGHT, PYRAMID_REACH } from '../../landmarkDimensions'

/** Fixed desert landmarks, shared by Features (to draw them) and the layout (to keep clear of them). */

export const ARCHES: readonly ArchConfig[] = [
  { pos: [1200, 0, -400], rotY: 0.3, scale: 1.0 },
  { pos: [-1000, 0, 800], rotY: 1.5, scale: 0.85 },
  { pos: [600, 0, 1400], rotY: 2.8, scale: 1.15 },
  { pos: [-1400, 0, -600], rotY: 4.2, scale: 0.9 },
]

/**
 * The Pyramid, turned (`yaw`, about y) to face the middle of the level square on: the ride (#864) comes at it from there,
 * dives into a doorway in its second tier's west face, rides the `passage` through the tier along the Pyramid's own x and
 * out of the east face.
 */
export const PYRAMID = { x: 2000, z: -1600, yaw: Math.atan2(1600, 2000) }

/** The passage through the Pyramid's tier `layer` (#864): `width` wide, `height` over the tier below's top, along its centre. */
export const PYRAMID_PASSAGE = { layer: 1, width: 70, height: 60 } as const
/** The passage's floor (the top of the tier below), over the Pyramid's base. */
export const PYRAMID_PASSAGE_FLOOR = PYRAMID_PASSAGE.layer * PYRAMID_LAYER_HEIGHT

/** Circles (XZ) that mesas and dust devils stay out of. */
export const LANDMARK_FOOTPRINTS: readonly { x: number; z: number; r: number }[] = [
  { x: PYRAMID.x, z: PYRAMID.z, r: PYRAMID_REACH },
  ...ARCHES.map((a) => ({ x: a.pos[0], z: a.pos[2], r: ARCH_REACH * a.scale })),
]
