import { describe, expect, it } from 'vitest'
import { shippedLevels } from '@/levels/shippedLevels'
import { buildArcTable, indexAtT, tAtLoopDistance } from '@/track/arcLength'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { rideModel, rideProfile, riddenBetween } from '@/track/ridePhysics'
import { withTunnels } from '@/track/setPieces'
import { getTrackDimensions } from '@/track/trackDimensions'
import { ENEMY_PLACEMENT } from '@/entities/spawning/enemyPlacement'
import { FORMATIONS, TRACKSIDE } from '@/entities/spawning/spawnPlacement'
import { createHeightFunction, getTerrainMeshSize, sampleTrackPath } from '@/utils/terrainNoise'
import type { RiddenLevel, WhaleBreachSpec } from '@/types/level'
import { maxGroundUnder } from './seaPlacement'
import { BREACH, WHALE_LENGTH, breachPhase, breachSite, rideHeading, whalePose, type WhalePose } from './whaleBreach'

const WHALE_LEVELS = shippedLevels().filter((l): l is RiddenLevel & { environment: { whale: WhaleBreachSpec } } => !!l.environment.whale)
const HALF = WHALE_LENGTH / 2
const STEPS = 24
const pose: WhalePose = { x: 0, y: 0, z: 0, pitch: 0, roll: 0 }

it('a whale breaches only where a level asks for one, only at sea, and on level 3 off the top of the first drop (#865)', () => {
  expect(WHALE_LEVELS.map((l) => l.id)).toContain('level3')
  for (const level of WHALE_LEVELS) expect(level.biome).toBe('ocean')
  const ocean = WHALE_LEVELS.find((l) => l.id === 'level3')!.environment.whale
  const mid = ocean.startSeconds + BREACH.seconds / 2
  expect(mid).toBeGreaterThan(10)
  expect(mid).toBeLessThan(14)
})

describe.each(WHALE_LEVELS.map((l) => [l.id, l] as const))('the whale breach on %s', (_id, level) => {
  const spec = level.environment.whale
  const curve = createTrackCurve(level.track)
  // The table the scene rides (`LevelScene`): the curve's, with its tunnels.
  const table = withTunnels(buildArcTable(curve), level.track.tunnels, getTrackDimensions(level.track).trackScale)
  const speeds = rideModel(level.track, table)
  const site = breachSite(table, speeds, spec)
  const end = spec.startSeconds + BREACH.seconds
  const profile = rideProfile(table, speeds, end)

  function rider(u: number) {
    const dist = site.from + u * (site.to - site.from)
    const i = indexAtT(table, tAtLoopDistance(table, dist))
    return { x: table.x[i], y: table.y[i], z: table.z[i], heading: rideHeading(table, i) }
  }

  it('comes once the ride is under way and is gone well before the boss', () => {
    expect(spec.startSeconds).toBeGreaterThan(0)
    if (level.boss) expect(level.boss.at - end).toBeGreaterThan(5)
  })

  it('runs on ride distance, the same every run', () => {
    expect(breachSite(table, speeds, spec)).toEqual(site)
    expect(breachPhase(site, site.from)).toBe(0)
    expect(breachPhase(site, site.to)).toBe(1)
    expect(breachPhase(site, site.from - 1)).toBeLessThan(0)
    expect(breachPhase(site, site.to + 1)).toBeGreaterThan(1)
  })

  it('starts and ends with the whole body under the water and clears it at the top', () => {
    const thick = 0.1 * WHALE_LENGTH
    for (const u of [0, 1]) {
      whalePose(site, u, pose)
      expect(pose.y + HALF * Math.abs(Math.sin(pose.pitch)) + thick).toBeLessThan(0)
    }
    whalePose(site, 0.5, pose)
    expect(pose.pitch).toBeCloseTo(0)
    expect(pose.y - thick).toBeGreaterThan(0)
  })

  it('stays in front of the rider, swimming across its sightline', () => {
    let worst = 0
    for (let k = 0; k <= STEPS; k++) {
      const u = k / STEPS
      const r = rider(u)
      whalePose(site, u, pose)
      const dx = pose.x - r.x
      const dz = pose.z - r.z
      const off = Math.acos((dx * r.heading.x + dz * r.heading.z) / Math.hypot(dx, dz))
      worst = Math.max(worst, off)
    }
    expect((worst * 180) / Math.PI).toBeLessThan(25)
    const mid = rider(0.5)
    expect(Math.abs(site.dirX * (site.x - mid.x) + site.dirZ * (site.z - mid.z))).toBeLessThan(1e-6)
  })

  it('breaches in open water past the drawn terrain, in plain sight of the rider', () => {
    const heightFn = createHeightFunction('ocean', sampleTrackPath((t) => curve.getPointAt(t)))
    const edge = getTerrainMeshSize('ocean') / 2
    const groundFn = (x: number, z: number) => (Math.max(Math.abs(x), Math.abs(z)) > edge ? -Infinity : heightFn(x, z))
    const blocked: string[] = []
    for (let k = 0; k <= STEPS; k++) {
      const u = k / STEPS
      whalePose(site, u, pose)
      if (maxGroundUnder(groundFn, pose.x, pose.z, HALF) > -10) blocked.push(`u ${u.toFixed(2)}: ground under it`)
      const r = rider(u)
      const top = Math.max(pose.y, 20)
      for (let j = 1; j < 40; j++) {
        const f = j / 40
        if (groundFn(r.x + (pose.x - r.x) * f, r.z + (pose.z - r.z) * f) > r.y + (top - r.y) * f) {
          blocked.push(`u ${u.toFixed(2)}: land in the way`)
          break
        }
      }
    }
    expect(blocked).toEqual([])
  })

  it('never comes near the track', () => {
    let nearest = Infinity
    for (let k = 0; k <= STEPS; k++) {
      whalePose(site, k / STEPS, pose)
      for (let i = 0; i < table.count; i += 8) nearest = Math.min(nearest, Math.hypot(table.x[i] - pose.x, table.z[i] - pose.z))
    }
    expect(nearest).toBeGreaterThan(HALF + TRACKSIDE.water.sideMax)
  })

  it('never stands, as a disc of half its length seen from above, in the sightline to any spot a target can be during the breach', () => {
    const MARGIN = 60
    const bands: { from: number; to: number; side: number }[] = []
    const discs: number[] = []
    for (const wave of level.enemies) {
      const at = wave.spawnDelay ?? 0
      if (at >= end) continue
      const start = riddenBetween(profile, 0, at)
      const rule = ENEMY_PLACEMENT[wave.type]
      if (wave.formation && wave.formation !== 'scatter') {
        const f = FORMATIONS[wave.formation]
        const reach = f.spacing * f.groupSize
        const groups = Math.ceil(wave.count / f.groupSize)
        bands.push({ from: start, to: start + f.origin.ahead + f.groupGap * (groups - 1) + reach, side: Math.abs(f.origin.side) + reach })
      } else if (rule.scatter === 'trackside') {
        const b = TRACKSIDE[rule.surface === 'water' ? 'water' : 'ground']
        bands.push({ from: start, to: start + b.aheadMax, side: b.sideMax + (rule.roam ?? 0) })
      } else if (typeof rule.scatter === 'object') {
        discs.push(rule.scatter.radiusMin + rule.scatter.radiusSpan)
      } else {
        throw new Error(`${wave.type}: no placement rule to check`)
      }
    }
    expect(bands.length).toBeGreaterThan(0)

    const hidden: string[] = []
    for (let k = 0; k <= STEPS; k++) {
      const u = k / STEPS
      const r = rider(u)
      whalePose(site, u, pose)
      const wx = pose.x - r.x
      const wz = pose.z - r.z
      const dist = Math.hypot(wx, wz)
      const half = Math.asin(HALF / dist)
      for (const band of bands) {
        for (let d = band.from; d <= band.to; d += 20) {
          const i = indexAtT(table, tAtLoopDistance(table, d))
          const px = table.x[i] - r.x
          const pz = table.z[i] - r.z
          const pd = Math.hypot(px, pz)
          const reach = band.side + MARGIN
          if (pd + reach < dist - HALF) continue
          const spread = pd <= reach ? Math.PI : Math.asin(reach / pd)
          const angle = Math.acos(Math.min(1, Math.max(-1, (px * wx + pz * wz) / (pd * dist))))
          if (angle < half + spread) hidden.push(`u ${u.toFixed(2)}: track ${Math.round(d)} (${Math.round(pd)} away)`)
        }
      }
      for (const radius of discs) {
        for (const a of [-half, 0, half]) {
          const c = Math.cos(a)
          const s = Math.sin(a)
          const dx = (wx * c - wz * s) / dist
          const dz = (wx * s + wz * c) / dist
          const along = -(r.x * dx + r.z * dz)
          const across2 = r.x * r.x + r.z * r.z - along * along
          const R = radius + MARGIN
          if (across2 < R * R && along + Math.sqrt(R * R - across2) > dist - HALF) hidden.push(`u ${u.toFixed(2)}: scatter disc ${radius}`)
        }
      }
    }
    expect(hidden).toEqual([])
  })
})
