/** Where and when Ocean's whale breaches (#793), on ride distance so it plays the same every run and in `npm run clip`. */
import { indexAtT, tAtLoopDistance, type ArcTable } from '@/track/arcLength'
import { rideProfile, riddenBetween, type RideSpeeds } from '@/track/ridePhysics'

export const WHALE_LENGTH = 700

export const BREACH = {
  /** Level seconds at the ride's own pace (`rideProfile`): it runs on ride distance, so slow-mo slows it with the car. */
  startSeconds: 31.25,
  seconds: 2.75,
  /** Out along the rider's heading at mid-breach, past the drawn terrain's edge: the islands end there, the sea runs on. */
  lead: 3700,
  /** Turned off that heading (radians, toward the ride's left): through the gap between two islands. */
  aim: 0.1,
  travel: 300,
  /** The centre starts and ends this far under the surface (the whole body under), and peaks this far above it. */
  depth: 0.6 * WHALE_LENGTH,
  apex: 0.2 * WHALE_LENGTH,
  pitch: 1.2,
  roll: 1.6,
} as const

/** Phases of the splashes: the nose bursting out, then the body crashing back (with the shake). */
export const SPLASH_RISE = 0.08
export const SPLASH_FALL = 0.74

export interface BreachSite {
  from: number
  to: number
  x: number
  z: number
  dirX: number
  dirZ: number
}

export function rideHeading(table: ArcTable, dist: number): { x: number; z: number } {
  const n = table.count - 1
  const i = indexAtT(table, tAtLoopDistance(table, dist))
  const a = (i - 2 + n) % n
  const b = (i + 2) % n
  const dx = table.x[b] - table.x[a]
  const dz = table.z[b] - table.z[a]
  const h = Math.hypot(dx, dz) || 1
  return { x: dx / h, z: dz / h }
}

export function breachSite(table: ArcTable, speeds: RideSpeeds): BreachSite {
  const end = BREACH.startSeconds + BREACH.seconds
  const profile = rideProfile(table, speeds, end)
  const from = riddenBetween(profile, 0, BREACH.startSeconds)
  const to = riddenBetween(profile, 0, end)
  const mid = (from + to) / 2
  const i = indexAtT(table, tAtLoopDistance(table, mid))
  const h = rideHeading(table, mid)
  const c = Math.cos(BREACH.aim)
  const s = Math.sin(BREACH.aim)
  const ax = h.x * c + h.z * s
  const az = h.z * c - h.x * s
  return { from, to, x: table.x[i] + ax * BREACH.lead, z: table.z[i] + az * BREACH.lead, dirX: -az, dirZ: ax }
}

export function breachPhase(site: BreachSite, ridden: number): number {
  return (ridden - site.from) / (site.to - site.from)
}

export interface WhalePose {
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
  roll: number
}

export function whalePose(site: BreachSite, u: number, out: WhalePose): WhalePose {
  const along = (u - 0.5) * BREACH.travel
  out.x = site.x + site.dirX * along
  out.z = site.z + site.dirZ * along
  out.y = -BREACH.depth + (BREACH.depth + BREACH.apex) * Math.sin(Math.PI * u)
  out.yaw = Math.atan2(site.dirX, site.dirZ)
  out.pitch = BREACH.pitch * Math.cos(Math.PI * u)
  const r = Math.min(Math.max((u - 0.2) / 0.7, 0), 1)
  out.roll = BREACH.roll * r * r * (3 - 2 * r)
  return out
}

/** How far along `dir` from the centre the body's axis meets the surface: where the water breaks, within the body. */
export function surfaceOffset(pose: WhalePose): number {
  const rise = Math.sin(pose.pitch)
  const half = WHALE_LENGTH / 2
  const axial = Math.abs(rise) < 1e-3 ? 0 : Math.min(Math.max(-pose.y / rise, -half), half)
  return axial * Math.cos(pose.pitch)
}
