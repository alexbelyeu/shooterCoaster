import { describe, expect, it } from 'vitest'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { buildArcTable } from '@/track/arcLength'
import { rideModel } from '@/track/ridePhysics'
import { BEAT_TOLERANCE_SECONDS } from '@/track/rideV2'
import { eyeClearance, type Box } from '@/track/elements/headChopper'
import { getTrackDimensions } from '@/track/trackDimensions'
import { shippedLevel } from '@/levels/shippedLevels'
import type { TrackParams } from '@/types/level'
import { trackExtent } from '../../shared/trackScatter'
import { buildCityRide, CITY_TRACK } from './cityTrack'
import { layoutCity, layoutHeroTower, type Tower } from './cityLayout'
import { RIDE_TOWERS } from './config'
import { DECK, HIGHWAY } from './highwayLayout'

const DEG = 180 / Math.PI
const solid = (t: Tower): Box => ({ min: { x: t.x - t.w / 2, y: -10, z: t.z - t.d / 2 }, max: { x: t.x + t.w / 2, y: t.h, z: t.z + t.d / 2 } })
const deck: Box = {
  min: { x: HIGHWAY.from.x, y: HIGHWAY.deck - DECK.thickness, z: HIGHWAY.from.z - DECK.width / 2 },
  max: { x: HIGHWAY.to.x, y: HIGHWAY.deck + DECK.parapet, z: HIGHWAY.from.z + DECK.width / 2 },
}

// The authored ride and the one the game ships (`cityLevel.ts`, rounded to whole units by `gen-ride-levels.mjs`).
describe.each([
  ['as shipped', shippedLevel('level7').track],
  ['as authored', CITY_TRACK],
] as [string, TrackParams][])("level 7's ride (#871), %s", (_name, track) => {
  const curve = createTrackCurve(track)
  const table = buildArcTable(curve)
  const plan = rideModel(track, table).plan!
  const eye = getTrackDimensions(track).eyeHeight
  const ride = buildCityRide()

  it('lands every storyboard beat on its second', () => {
    const want = track.ride === 'v2' ? track.rideV2!.beats!.map((b) => b.second) : []
    expect(plan.landed).toHaveLength(want.length)
    plan.landed.forEach((s, i) => expect(Math.abs(s - want[i])).toBeLessThanOrEqual(BEAT_TOLERANCE_SECONDS))
  })

  it("has the kit's elements: a station, a lift hill, airtime, a helix and the near miss", () => {
    const kinds = ride.markers.map((m) => m.kind)
    for (const k of ['station', 'liftHill', 'airtimeHill', 'slowMotion', 'helix', 'headChopper'] as const) expect(kinds).toContain(k)
  })

  it('drops at least 60° off the lift', () => {
    let steepest = 0
    for (let i = 1; i < table.count && table.s[i] < table.length / 3; i++) {
      const ds = table.s[i] - table.s[i - 1]
      if (ds > 0) steepest = Math.max(steepest, Math.asin(Math.min(1, (table.y[i - 1] - table.y[i]) / ds)))
    }
    expect(steepest * DEG).toBeGreaterThanOrEqual(60)
  })

  it('passes under the elevated highway close but clear: the near miss', () => {
    const near = eyeClearance(curve, deck, eye)
    expect(near).toBeGreaterThan(eye / 2)
    expect(near).toBeLessThan(2 * eye)
  })

  it('passes the ride towers close on both sides, and every tower and the hero tower clear', () => {
    const near = RIDE_TOWERS.map((t) => eyeClearance(curve, solid(t), eye, 0, 1, 4000))
    for (const d of near) expect(d).toBeLessThan(8 * eye)
    const { towers } = layoutCity(table, trackExtent(table))
    const all = [...towers, ...layoutHeroTower().tiers]
    let closest = Infinity
    for (const t of all) closest = Math.min(closest, eyeClearance(curve, solid(t), eye, 0, 1, 2000))
    expect(closest).toBeGreaterThan(4 * eye)
  })

  it('winds the helix round the hero tower', () => {
    const helix = ride.markers.find((m) => m.kind === 'helix')!
    const hero = layoutHeroTower().tiers[0]
    const distances = ride.points.slice(helix.from, helix.to + 1).map((p) => Math.hypot(p.x - hero.x, p.z - hero.z))
    expect(Math.max(...distances)).toBeLessThan(2.5 * hero.w)
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
