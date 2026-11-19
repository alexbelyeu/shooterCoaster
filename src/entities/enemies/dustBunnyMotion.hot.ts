/**
 * A dust bunny's drift (#515): it rolls slowly along its heading, weaving a little from side to side, bobbing over
 * the floor and squashing each time it touches down. Pure, on game time (seconds since it started).
 */

export const DUST_BUNNY = {
  /** World units / s along its heading. */
  speed: 26,
  /** Side-to-side weave: amplitude (world units) and cycles / s. */
  weave: 30,
  weaveHz: 0.15,
  /** Bounces / s and their height (model units, under the model's scale). */
  bobHz: 1.4,
  bob: 0.45,
  /** How much it flattens at each touchdown (fraction of its height). */
  squash: 0.14,
} as const

/** Fraction of a bounce's height by which the touchdown squash has eased off. */
const SQUASH_EASE = 0.3
/** Where lift and squash, both linear in the hop, change slope: the deepest point of a bounce is at one of them. */
const HOP_CORNERS = [0, SQUASH_EASE, 1] as const

/** One bounce, seconds: the turntable's motion strip. */
export const DUST_BUNNY_BOUNCE = 1 / DUST_BUNNY.bobHz

export interface DustBunnyPose {
  /** Offset from where it started, world units. */
  x: number
  z: number
  /** Yaw of its travel (0 = +z). */
  heading: number
  /** Radians rolled about its own x axis. */
  roll: number
  /** Height of its centre over its resting height, model units. */
  lift: number
  /** 0 in the air, up to `DUST_BUNNY.squash` at touchdown. */
  squash: number
}

// eslint-disable-next-line sc/no-hot-path-alloc -- cold: once per dust bunny, then stepped in place
export const newDustBunnyPose = (): DustBunnyPose => ({ x: 0, z: 0, heading: 0, roll: 0, lift: 0, squash: 0 })

/**
 * The pose `t` seconds after it started drifting along `base` (radians, 0 = +z), rolling on a ball of
 * `rollRadius` world units, into `out`.
 */
export function dustBunnyPose(base: number, rollRadius: number, t: number, out: DustBunnyPose): DustBunnyPose {
  const time = Math.max(0, t)
  const w = 2 * Math.PI * DUST_BUNNY.weaveHz
  const along = DUST_BUNNY.speed * time
  const side = DUST_BUNNY.weave * Math.sin(w * time)
  const sb = Math.sin(base)
  const cb = Math.cos(base)
  // Along base (sin, cos), and side to side along its right (cos, -sin).
  out.x = along * sb + side * cb
  out.z = along * cb - side * sb
  out.heading = base + Math.atan2(DUST_BUNNY.weave * w * Math.cos(w * time), DUST_BUNNY.speed)
  out.roll = along / rollRadius
  const hop = Math.abs(Math.sin(Math.PI * DUST_BUNNY.bobHz * time))
  out.lift = DUST_BUNNY.bob * hop
  out.squash = DUST_BUNNY.squash * Math.max(0, 1 - hop / SQUASH_EASE)
  return out
}

/**
 * How far below its centre's resting height the bunny ever reaches over a bounce, model units, for fluff `reach` from its centre:
 * the squash flattens it at touchdown and eases off as it lifts, so its lowest point can come just after touchdown.
 */
export function dustBunnyDrop(reach: number): number {
  let drop = 0
  for (const hop of HOP_CORNERS) {
    const squash = DUST_BUNNY.squash * Math.max(0, 1 - hop / SQUASH_EASE)
    drop = Math.max(drop, reach * (1 - squash) - DUST_BUNNY.bob * hop)
  }
  return drop
}
