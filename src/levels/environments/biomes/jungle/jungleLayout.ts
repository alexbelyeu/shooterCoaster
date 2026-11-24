import type { ArcTable } from '@/track/arcLength'
import { buildTrackIndex } from '@/levels/environments/shared/trackClearance'
import type { HeightFunction } from '@/utils/terrainNoise'
import { createRng } from '@/utils/rng'
import { FALLS, TEMPLE } from './config'
import type { MistBank } from './jungleShaders'

// Where Jungle Ruins' mist lies (#870), pure: banks in the valleys beside the ride, round the temple's foot and in
// the waterfall's spray.

/** A valley bank's distance off the rails: never over them, so it never veils the rider's targets. */
const MIST_OFF_TRACK = { min: 160, max: 520 }
/** Only where the ride runs low: the valleys. */
const MIST_TRACK_BELOW = 80
const VALLEY_BANKS = 34

/** The cliff behind the pool, `FALLS.yaw` facing the ride: its centre and the radius its face stands at. */
export const CLIFF = {
  x: FALLS.x - Math.sin(FALLS.yaw) * 250,
  z: FALLS.z - Math.cos(FALLS.yaw) * 250,
  radius: 200,
} as const

export function mistBanks(track: ArcTable, groundFn: HeightFunction): MistBank[] {
  const rng = createRng(8701)
  const index = buildTrackIndex(track)
  const banks: MistBank[] = []
  for (let tries = 0; banks.length < VALLEY_BANKS && tries < VALLEY_BANKS * 20; tries++) {
    const i = Math.floor(rng() * track.count)
    if (track.y[i] > MIST_TRACK_BELOW) continue
    const a = rng() * Math.PI * 2
    const d = MIST_OFF_TRACK.min + rng() * (MIST_OFF_TRACK.max - MIST_OFF_TRACK.min)
    const x = track.x[i] + Math.cos(a) * d
    const z = track.z[i] + Math.sin(a) * d
    const halfWidth = 160 + rng() * 140
    if (index.near(x, z, MIST_OFF_TRACK.min - 20)) continue
    banks.push({ x, y: groundFn(x, z) + 30 + rng() * 25, z, halfWidth, halfHeight: 45 + rng() * 25 })
  }
  // Round the temple's foot, and the spray where the fall lands
  for (let k = 0; k < 5; k++) {
    const a = TEMPLE.yaw + (k / 5) * Math.PI * 2 + 0.3
    const r = TEMPLE.base + 60
    banks.push({ x: TEMPLE.x + Math.sin(a) * r, y: TEMPLE.ground + 30, z: TEMPLE.z + Math.cos(a) * r, halfWidth: 220, halfHeight: 50 })
  }
  for (let k = 0; k < 3; k++) {
    const side = k - 1
    banks.push({
      x: FALLS.x + Math.cos(FALLS.yaw) * side * 70 - Math.sin(FALLS.yaw) * 60,
      y: FALLS.ground + 40 + k * 12,
      z: FALLS.z - Math.sin(FALLS.yaw) * side * 70 - Math.cos(FALLS.yaw) * 60,
      halfWidth: 120,
      halfHeight: 70,
    })
  }
  return banks
}
