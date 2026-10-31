/** Where a level's weapon pickups float (#185); pure, so keep React / three imports out. */
import { PICKUP_WEAPONS, type PickupWeaponId } from '@/combat/weapons/weaponTypes'
import { createRng, hashString } from '@/utils/rng'
import type { Vec3 } from '@/entities/spawning/spawnPlacement'

export interface PickupSpot {
  id: PickupWeaponId
  /** Track parameter, as `rideProgress`. */
  t: number
  position: Vec3
}

/** Height above the rails at trackScale 1; grows with the track like the rider's eye. */
export const PICKUP_HEIGHT = 25
/** Every level's run rides at least 0.38 of the track parameter before its timer ends. */
export const PICKUP_SPAN: readonly [number, number] = [0.05, 0.33]
const SLOT_JITTER = 0.6
export const MIN_PICKUPS = 2
export const MAX_PICKUPS = 4

/** One per slot of the span, in config order; the layout rng is seeded from the level id. */
export function placePickups(
  levelId: string,
  ids: readonly PickupWeaponId[] = PICKUP_WEAPONS,
  pointAt: (t: number) => Vec3,
  trackScale: number,
): PickupSpot[] {
  const rng = createRng(hashString(`pickups:${levelId}`))
  const n = Math.min(ids.length, MAX_PICKUPS)
  const [from, to] = PICKUP_SPAN
  const slot = (to - from) / Math.max(n, 1)
  const spots: PickupSpot[] = []
  for (let i = 0; i < n; i++) {
    const t = from + slot * (i + 0.5 + (rng() - 0.5) * SLOT_JITTER)
    const p = pointAt(t)
    spots.push({ id: ids[i], t, position: { x: p.x, y: p.y + PICKUP_HEIGHT * trackScale, z: p.z } })
  }
  return spots
}
