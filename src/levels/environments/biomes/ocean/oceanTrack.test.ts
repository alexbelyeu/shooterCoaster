import { describe, expect, it } from 'vitest'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { buildArcTable, distanceAtT } from '@/track/arcLength'
import { rideModel } from '@/track/ridePhysics'
import { BEAT_TOLERANCE_SECONDS } from '@/track/rideV2'
import { getTunnelDims } from '@/track/setPieces'
import { getTrackDimensions } from '@/track/trackDimensions'
import { getLevelConfig } from '@/levels/LevelRegistry'
import type { TrackParams } from '@/types/level'
import { buildOceanRide, OCEAN_TRACK } from './oceanTrack'

// The authored ride and the one the game ships (`oceanLevel.ts`, rounded by `gen-ocean-level.mjs`).
describe.each([
  ['as shipped', getLevelConfig('level3')!.track],
  ['as authored', OCEAN_TRACK],
] as [string, TrackParams][])("level 3's ride (#865), %s", (_name, track) => {
  const curve = createTrackCurve(track)
  const table = buildArcTable(curve)
  const plan = rideModel(track, table).plan!

  it('lands every storyboard beat on its second', () => {
    const want = track.ride === 'v2' ? track.rideV2!.beats!.map((b) => b.second) : []
    expect(plan.landed.length).toBe(want.length)
    plan.landed.forEach((s, i) => expect(Math.abs(s - want[i])).toBeLessThanOrEqual(BEAT_TOLERANCE_SECONDS))
  })

  it("has the kit's elements: a station, two lift hills, airtime, a corkscrew and a helix", () => {
    const kinds = buildOceanRide().markers.map((m) => m.kind)
    for (const k of ['station', 'liftHill', 'airtimeHill', 'slowMotion', 'corkscrew', 'helix'] as const) expect(kinds).toContain(k)
    expect(kinds.filter((k) => k === 'liftHill')).toHaveLength(2)
  })

  it('drops at least 60° off the first lift', () => {
    let steepest = 0
    for (let i = 1; i < table.count && table.s[i] < table.length / 3; i++) {
      const ds = table.s[i] - table.s[i - 1]
      if (ds > 0) steepest = Math.max(steepest, Math.asin(Math.min(1, (table.y[i - 1] - table.y[i]) / ds)))
    }
    expect((steepest * 180) / Math.PI).toBeGreaterThanOrEqual(60)
  })

  it('splashes down at the surface into a glass tunnel that runs on under the water', () => {
    const [tunnel] = track.tunnels!
    expect(tunnel.glass).toBe(true)
    const dims = getTunnelDims(getTrackDimensions(track).trackScale)
    const fromS = distanceAtT(table, tunnel.from)
    const entry = table.y[Math.round((fromS / table.length) * (table.count - 1))]
    expect(entry).toBeGreaterThan(0)
    expect(entry).toBeLessThan(getTrackDimensions(track).eyeHeight)
    // Somewhere in it the whole tube, its crown included, is under the sea.
    let deepest = Infinity
    for (let i = 0; i < table.count; i++) if (table.s[i] > fromS && table.s[i] < fromS + tunnel.length) deepest = Math.min(deepest, table.y[i])
    expect(deepest + dims.centreUp + dims.radius + dims.wall).toBeLessThan(0)
  })

  it('keeps its passes apart: no stretch comes within 40 units of another', () => {
    let closest = Infinity
    for (let i = 0; i < table.count; i += 8) {
      for (let j = i + 8; j < table.count; j += 8) {
        const along = Math.min(table.s[j] - table.s[i], table.length - (table.s[j] - table.s[i]))
        if (along < 300) continue
        closest = Math.min(closest, Math.hypot(table.x[i] - table.x[j], table.y[i] - table.y[j], table.z[i] - table.z[j]))
      }
    }
    expect(closest).toBeGreaterThan(40)
  })
})
