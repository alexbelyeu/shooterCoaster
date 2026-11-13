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
  out.squash = DUST_BUNNY.squash * Math.max(0, 1 - hop / 0.3)
  return out
}
