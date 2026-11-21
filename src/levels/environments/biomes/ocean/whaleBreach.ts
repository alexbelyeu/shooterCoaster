/** Ocean's whale breach (#793): its shape (`BREACH`) and where it lands from the level's `environment.whale`, on ride distance so it plays the same every run and in `npm run clip`. */
import { MathUtils } from 'three'
import { indexAtT, tAtLoopDistance, type ArcTable } from '@/track/arcLength'
import { rideProfile, riddenBetween, type RideSpeeds } from '@/track/ridePhysics'
import type { WhaleBreachSpec } from '@/types/level'

export const WHALE_LENGTH = 700

export const BREACH = {
  seconds: 2.75,
  travel: 300,
  /** The centre starts and ends this far under the surface (the whole body under), and peaks this far above it. */
  depth: 0.6 * WHALE_LENGTH,
  apex: 0.2 * WHALE_LENGTH,
  pitch: 1.2,
  roll: 1.6,
} as const

/** Phase of the splash: the body crashing back (with the shake). */
export const SPLASH_FALL = 0.74

export interface BreachSite {
  from: number
  to: number
  x: number
  z: number
  dirX: number
  dirZ: number
}

/** The ride's heading in plan at sample `i`. */
export function rideHeading(table: ArcTable, i: number): { x: number; z: number } {
  const n = table.count - 1
  const a = (i - 2 + n) % n
  const b = (i + 2) % n
  const dx = table.x[b] - table.x[a]
  const dz = table.z[b] - table.z[a]
  const h = Math.hypot(dx, dz) || 1
  return { x: dx / h, z: dz / h }
}

export function breachSite(table: ArcTable, speeds: RideSpeeds, spec: WhaleBreachSpec): BreachSite {
  const end = spec.startSeconds + BREACH.seconds
  const profile = rideProfile(table, speeds, end)
  const from = riddenBetween(profile, 0, spec.startSeconds)
  const to = riddenBetween(profile, 0, end)
  const i = indexAtT(table, tAtLoopDistance(table, (from + to) / 2))
  const h = rideHeading(table, i)
  const c = Math.cos(spec.aim)
  const s = Math.sin(spec.aim)
  const ax = h.x * c + h.z * s
  const az = h.z * c - h.x * s
  return { from, to, x: table.x[i] + ax * spec.lead, z: table.z[i] + az * spec.lead, dirX: -az, dirZ: ax }
}

export function breachPhase(site: BreachSite, ridden: number): number {
  return (ridden - site.from) / (site.to - site.from)
}

export interface WhalePose {
  x: number
  y: number
  z: number
  pitch: number
  roll: number
}

export function whalePose(site: BreachSite, u: number, out: WhalePose): WhalePose {
  const along = (u - 0.5) * BREACH.travel
  out.x = site.x + site.dirX * along
  out.z = site.z + site.dirZ * along
  out.y = -BREACH.depth + (BREACH.depth + BREACH.apex) * Math.sin(Math.PI * u)
  out.pitch = BREACH.pitch * Math.cos(Math.PI * u)
  out.roll = BREACH.roll * MathUtils.smoothstep(u, 0.2, 0.9)
  return out
}
