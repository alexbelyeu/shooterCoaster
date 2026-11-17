/**
 * The Fire Imp's hop (pure, per frame): where it is in the air, how it stretches and squashes, and where its model
 * sits in its group so the hit sphere (`FIRE_IMP_HIT_RADIUS`, centred on the group) covers it through the whole hop.
 */

/** Hops a game second, its share of each hop in the air, and the hop's height (model units). */
export const HOP_RATE = 1.8
const AIRBORNE = 0.75
export const HOP_HEIGHT = 2.2
/** The model's scale and how far its feet sit below the group origin (world units): the sphere's centre is mid-body. */
export const FIRE_IMP_SCALE = 8
export const FIRE_IMP_LIFT = 36
/** The imp's collision radius (world units): feet at rest to the eyes at the top of a hop. */
export const FIRE_IMP_HIT_RADIUS = 55

export interface HopPose {
  /** 0 on the ground, 1 at the top of the hop. */
  air: number
  /** 0 off the ground, 1 at the deepest point of the landing squash. */
  land: number
  /** Up-stretch leaving and nearing the ground, 0 at the top. */
  stretch: number
}

/** The pose `p` of the way (0..1) through a hop cycle, written into `out`. */
export function fireImpHop(p: number, out: HopPose): HopPose {
  const inAir = p < AIRBORNE
  out.air = inAir ? Math.sin((Math.PI * p) / AIRBORNE) : 0
  out.land = inAir ? 0 : Math.sin((Math.PI * (p - AIRBORNE)) / (1 - AIRBORNE))
  out.stretch = inAir ? 0.12 * Math.abs(Math.cos((Math.PI * p) / AIRBORNE)) : 0
  return out
}

/** The hop group's vertical scale for a pose (squash and stretch about the feet). */
export const hopScaleY = (pose: HopPose) => 1 + pose.stretch - 0.24 * pose.land
/** Its horizontal scale. */
export const hopScaleXZ = (pose: HopPose) => 1 - 0.5 * pose.stretch + 0.16 * pose.land
