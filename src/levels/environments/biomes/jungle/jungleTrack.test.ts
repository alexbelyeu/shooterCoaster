import { describe, expect, it } from 'vitest'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { buildArcTable } from '@/track/arcLength'
import { rideModel } from '@/track/ridePhysics'
import { BEAT_TOLERANCE_SECONDS } from '@/track/rideV2'
import { getTrackDimensions } from '@/track/trackDimensions'
import { shippedLevel } from '@/levels/shippedLevels'
import type { TrackParams } from '@/types/level'
import { buildJungleRide, JUNGLE_TRACK } from './jungleTrack'
import { CLIFF } from './jungleLayout'
import { FALLS, TEMPLE } from './config'

const DEG = 180 / Math.PI

// The authored ride and the one the game ships (`jungleLevel.ts`, rounded to whole units by `gen-ride-levels.mjs`).
describe.each([
  ['as shipped', shippedLevel('level8').track],
  ['as authored', JUNGLE_TRACK],
] as [string, TrackParams][])("level 8's ride (#1009), %s", (_name, track) => {
  const curve = createTrackCurve(track)
  const table = buildArcTable(curve)
  const plan = rideModel(track, table).plan!
  const eye = getTrackDimensions(track).eyeHeight
  const ride = buildJungleRide()
  const flat = (i: number, x: number, z: number) => Math.hypot(table.x[i] - x, table.z[i] - z)

  it('lands every storyboard beat on its second', () => {
    const want = track.ride === 'v2' ? track.rideV2!.beats!.map((b) => b.second) : []
    expect(plan.landed).toHaveLength(want.length)
    plan.landed.forEach((s, i) => expect(Math.abs(s - want[i])).toBeLessThanOrEqual(BEAT_TOLERANCE_SECONDS))
  })

  it("has the kit's elements: a station, a lift hill, airtime and a helix", () => {
    const kinds = ride.markers.map((m) => m.kind)
    for (const k of ['station', 'liftHill', 'airtimeHill', 'slowMotion', 'helix'] as const) expect(kinds).toContain(k)
  })

  it('drops at least 60° off the lift, from over the treetops to the valley floor', () => {
    let steepest = 0
    let top = 0
    let bottom = Infinity
    for (let i = 1; i < table.count && table.s[i] < table.length / 3; i++) {
      const ds = table.s[i] - table.s[i - 1]
      if (ds > 0) steepest = Math.max(steepest, Math.asin(Math.min(1, (table.y[i - 1] - table.y[i]) / ds)))
      top = Math.max(top, table.y[i])
      bottom = Math.min(bottom, table.y[i])
    }
    expect(steepest * DEG).toBeGreaterThanOrEqual(60)
    expect(top).toBeGreaterThan(300)
    expect(top - bottom).toBeGreaterThan(250)
  })

  it('keeps clear of the temple, the waterfall and its cliff', () => {
    let temple = Infinity
    let falls = Infinity
    let cliff = Infinity
    for (let i = 0; i < table.count; i++) {
      temple = Math.min(temple, flat(i, TEMPLE.x, TEMPLE.z))
      falls = Math.min(falls, flat(i, FALLS.x, FALLS.z))
      cliff = Math.min(cliff, flat(i, CLIFF.x, CLIFF.z) - CLIFF.radius)
    }
    // The temple's corners stand base·√2 from its centre; the pool's terrace is 200 across
    expect(temple).toBeGreaterThan(TEMPLE.base * Math.SQRT2 + 200)
    expect(falls).toBeGreaterThan(250)
    expect(cliff).toBeGreaterThan(250)
  })

  it('rides the airtime crest in front of the waterfall', () => {
    const crest = ride.markers.find((m) => m.kind === 'slowMotion')!
    const p = ride.points[Math.round((crest.from + crest.to) / 2)]
    expect(Math.hypot(p.x - FALLS.x, p.z - FALLS.z)).toBeLessThan(450)
  })

  it('never passes another stretch of itself within 8 eye heights', () => {
    let closest = Infinity
    for (let i = 0; i < table.count; i += 4) {
      for (let j = i + 4; j < table.count; j += 4) {
        const apart = table.s[j] - table.s[i]
        if (apart < 40 * eye || table.length - apart < 40 * eye) continue
        closest = Math.min(closest, Math.hypot(table.x[i] - table.x[j], table.y[i] - table.y[j], table.z[i] - table.z[j]))
      }
    }
    expect(closest).toBeGreaterThan(8 * eye)
  })
})
