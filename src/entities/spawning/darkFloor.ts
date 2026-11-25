import type { DarkSectionSpec } from '@/types/level'
import { distanceAtT, type ArcTable } from '@/track/arcLength'
import type { Rng } from '@/utils/rng'
import type { Vec3 } from '@/utils/vec3'
import { indexAhead, trackTangent } from './spawnPlacement'

/**
 * A wave on a dark section's floor (#937: level 2's passage through the Pyramid, ridden in the dark over a floor high above
 * the terrain): its walkers stand along the floor ahead of the rider, between the rails and the walls, facing the car.
 */

/** A walker's floor: its height, and the heading (`Scorpion.tsx`'s: radians, facing `(cos, sin)` in XZ) it faces down the passage. */
export interface EnemyFloor {
  y: number
  heading: number
}

/** Seeded at load: `along` the floor's stretch ahead, 0..1; `side` of the rails, its sign the side and its size how far out. */
export interface FloorSlot {
  along: number
  side: number
}

/** Arc units past the rider the first walker stands at least: inside the flash's reach, out of the near field. */
const FLOOR_LEAD = 120
/** Clear of the rails (the car rides over them) and of the walls (a walker's half width and its sway). A level's floors and
 *  `darkFloor` waves are checked in `darkFloor.test.ts`, not here at run time. */
export const FLOOR_RAIL_CLEAR = 10
export const FLOOR_WALL_CLEAR = 17
/** Above the floor, as `spawnPlacement.ts` stands a ground enemy on the terrain. */
const FLOOR_OFFSET = 5

/** One per even step of the stretch (jittered inside it), alternating sides, so the passage has no empty run. */
export function darkFloorSlots(count: number, rng: Rng): FloorSlot[] {
  return Array.from({ length: count }, (_, i) => ({ along: (i + rng.range(0.2, 0.8)) / count, side: (i % 2 ? 1 : -1) * rng() }))
}

/**
 * The walkers on the floor of the dark section the rider is in or comes to next (the last one with a floor once past
 * them all): spread over the floored stretch from `FLOOR_LEAD` past the rider, or its start if further, to its end.
 */
export function placeOnDarkFloor(
  table: ArcTable, riderIndex: number, sections: readonly DarkSectionSpec[], slots: readonly FloorSlot[],
): { position: Vec3; floor: EnemyFloor }[] {
  const floored = sections.filter((s) => s.floor)
  const riderT = table.t[riderIndex]
  const section = floored.find((s) => s.to - s.ramp > riderT) ?? floored[floored.length - 1]
  const { below, halfWidth } = section.floor!
  const rider = table.s[riderIndex]
  const start = Math.max(distanceAtT(table, section.from + section.ramp), rider + FLOOR_LEAD)
  const end = Math.max(start, distanceAtT(table, section.to - section.ramp))
  const outMax = halfWidth - FLOOR_WALL_CLEAR
  return slots.map(({ along, side }) => {
    const i = indexAhead(table, riderIndex, start + along * (end - start) - rider)
    const t = trackTangent(table, i)
    const h = Math.hypot(t.x, t.z) || 1
    const out = Math.sign(side || 1) * (FLOOR_RAIL_CLEAR + Math.abs(side) * (outMax - FLOOR_RAIL_CLEAR))
    const y = table.y[i] - below
    return {
      // To the track's right (`spawnPlacement.ts` `tracksidePoint`'s side) for a positive side.
      position: { x: table.x[i] - (t.z / h) * out, y: y + FLOOR_OFFSET, z: table.z[i] + (t.x / h) * out },
      floor: { y, heading: Math.atan2(-t.z, -t.x) },
    }
  })
}
