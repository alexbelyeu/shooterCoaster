/**
 * A boss win ends the run early (#961): once the boss is beaten and nothing is left to shoot or still to come, the
 * defeat's sting and fireworks play out for `BOSS_WIN_HOLD_SECONDS` and the results follow, through the timer's own end.
 * Nothing scorable is skipped, so scores, `maxScore` and stars are untouched: an enemy left alive counts as gone only
 * when the rest of the run could never shoot it (`outOfReach`, #983).
 */
import { RUN_SECONDS } from './pacing'
import { distanceAtT, indexAtT, tAtDistance, type ArcTable } from '@/track/arcLength'
import { rideProfile, riddenBetween, type RideSpeeds } from '@/track/ridePhysics'
import type { EnemyType } from '@/types/level'
import type { Vec3 } from '@/utils/vec3'
import { sightClear, type HeightFunction } from '@/utils/terrainNoise'

/** Game seconds from the clear to the results: the boss's defeat sting and fireworks. */
export const BOSS_WIN_HOLD_SECONDS = 3

/**
 * Whether the run has nothing left once its boss is beaten: no enemy left to kill (`enemies`, the spawner's remaining
 * count, waves still to arrive included, less those out of reach for the rest of the run, `outOfReach`), no golden balloon still up and no wave still due (`nextWaveDue`, null once
 * every wave is in, a hard-route wave the run skipped included).
 */
export function nothingLeft(bossBeaten: boolean, enemies: number, golden: number, waveDue: number | null): boolean {
  return bossBeaten && enemies <= 0 && golden <= 0 && waveDue === null
}

/** Level time a run cleared at `clearedAt` ends at, or null when the timer would end it first (cleared in its last seconds). */
export function bossWinEndsAt(clearedAt: number, runSeconds = RUN_SECONDS): number | null {
  const at = clearedAt + BOSS_WIN_HOLD_SECONDS
  return at < runSeconds ? at : null
}

/**
 * Enemies that follow the rider (#983): a crow or a toucan the rider has passed flies back round in front of it
 * (`FlapBird`, `leftBehind.hot.ts`), so it is never out of reach.
 */
export const FOLLOWS_RIDER: ReadonlySet<string> = new Set<EnemyType>(['crow', 'toucan'])

/** Track samples `outOfReach` walks: the loop's arc in this many even steps. */
export const REACH_SAMPLES = 512

/**
 * The run's ride for `outOfReach`, built once per level: `REACH_SAMPLES` points evenly along the track's arc, each
 * (x, y, z, and its unit heading along the track) in `points`, 1 in `either` where the seat rides facing back
 * (`ArcTable.backwards`), and the arc ridden at each tenth of a second of the run (`rideProfile`).
 */
export interface RunReach {
  table: ArcTable
  points: Float32Array
  either: Uint8Array
  profile: Float64Array
}

export function runReach(table: ArcTable, speeds: RideSpeeds, runSeconds = RUN_SECONDS): RunReach {
  const points = new Float32Array(REACH_SAMPLES * 6)
  const either = new Uint8Array(REACH_SAMPLES)
  const step = table.length / REACH_SAMPLES
  const at = (i: number) => indexAtT(table, tAtDistance(table, step * (i % REACH_SAMPLES)))
  for (let i = 0; i < REACH_SAMPLES; i++) {
    const k = at(i)
    const next = at(i + 1)
    const dx = table.x[next] - table.x[k]
    const dy = table.y[next] - table.y[k]
    const dz = table.z[next] - table.z[k]
    const d = Math.hypot(dx, dy, dz) || 1
    points.set([table.x[k], table.y[k], table.z[k], dx / d, dy / d, dz / d], i * 6)
    either[i] = table.backwards?.some((b) => step * (i + 1) >= b.from && step * i <= b.to) ? 1 : 0
  }
  return { table, points, either, profile: rideProfile(table, speeds, runSeconds) }
}

/**
 * Whether an enemy at `p` is out of the rider's reach for the rest of the run once the boss is beaten (#983): from no
 * point of the track the rest of the run rides (from the rider's track parameter `t` at `levelTime` to the run's end,
 * wrapping round the loop) is it within `range` (its kind's shootable distance, `maxReadableDistance`), in view and in
 * sight. In view: less than ~78° off the track's heading (cosine 0.2; the view looks along the track, never back, but
 * leads it into a turn), either way where the seat rides backwards. In sight: no `ground` over the line from the eye
 * (`eyeLift` over the rails) to the enemy's top (`top` over `p`). The rider's own spot is the first point. The ride
 * left is the profile's with a quarter more, as a run that fell behind its profile (slow-mo) may make some up on a fast
 * stretch. Such an enemy could never be shot: it counts as gone for the boss win. Called a few times a second, it
 * allocates nothing.
 */
export function outOfReach(
  p: Vec3, top: number, reach: RunReach, ground: HeightFunction, eyeLift: number, t: number, levelTime: number, range: number, runSeconds = RUN_SECONDS,
): boolean {
  const { table, points, either } = reach
  const step = table.length / REACH_SAMPLES
  const from = Math.floor(distanceAtT(table, ((t % 1) + 1) % 1) / step)
  const steps = Math.min(REACH_SAMPLES, Math.ceil((1.25 * riddenBetween(reach.profile, levelTime, runSeconds)) / step) + 2)
  for (let n = 0; n < steps; n++) {
    const s = (from + n) % REACH_SAMPLES
    const i = s * 6
    const x = points[i]
    const y = points[i + 1] + eyeLift
    const z = points[i + 2]
    const d = Math.hypot(p.x - x, p.y - y, p.z - z)
    const ahead = (p.x - x) * points[i + 3] + (p.y - y) * points[i + 4] + (p.z - z) * points[i + 5]
    if (d <= range && (either[s] ? Math.abs(ahead) : ahead) >= 0.2 * d && sightClear(ground, x, y, z, p.x, p.y + top, p.z)) return false
  }
  return true
}
