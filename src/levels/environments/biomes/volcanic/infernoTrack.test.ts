import { describe, expect, it } from 'vitest'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { buildArcTable } from '@/track/arcLength'
import { rideModel } from '@/track/ridePhysics'
import { BEAT_TOLERANCE_SECONDS } from '@/track/rideV2'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { createHeightFunction } from '@/utils/terrainNoise'
import type { TrackParams } from '@/types/level'
import { coneCrossings, coneRadius, VOLCANO, VOLCANO_SITE } from '../../volcanoGeometry'
import { buildInfernoRide, INFERNO_TRACK, VOLCANO_BASE_Y } from './infernoTrack'

/** Horizontal distance from the volcano's axis. */
const fromAxis = (p: { x: number; z: number }) => Math.hypot(p.x - VOLCANO_SITE.x, p.z - VOLCANO_SITE.z)

it("stands the volcano where the ride's base height says (the ground at its site, which the track doesn't reach)", () => {
  expect(Math.round(createHeightFunction('volcanic')(VOLCANO_SITE.x, VOLCANO_SITE.z))).toBe(VOLCANO_BASE_Y)
})

// The authored ride and the one the game ships (`infernoLevel.ts`, rounded by `scripts/gen-ride-levels.mjs`).
describe.each([
  ['as shipped', getLevelConfig('level5')!.track],
  ['as authored', INFERNO_TRACK],
] as [string, TrackParams][])("level 5's ride (#867), %s", (_name, track) => {
  const curve = createTrackCurve(track)
  const table = buildArcTable(curve)
  const plan = rideModel(track, table).plan!

  it('lands every storyboard beat on its second', () => {
    const want = track.ride === 'v2' ? track.rideV2!.beats!.map((b) => b.second) : []
    expect(plan.landed.length).toBe(want.length)
    plan.landed.forEach((s, i) => expect(Math.abs(s - want[i])).toBeLessThanOrEqual(BEAT_TOLERANCE_SECONDS))
  })

  it("has the kit's elements: a station, a lift hill, the drop tower, airtime, the near miss and the backwards stretch", () => {
    const kinds = buildInfernoRide().markers.map((m) => m.kind)
    for (const k of ['station', 'liftHill', 'dropTrack', 'airtimeHill', 'slowMotion', 'headChopper', 'backwards'] as const) expect(kinds).toContain(k)
  })

  it('launches out of the lava tube', () => {
    expect(track.tunnels).toHaveLength(1)
    const mouth = track.tunnels![0]
    expect(mouth.from).toBeLessThan(0.01)
    const station = track.mechanics!.find((m) => m.kind === 'station')!
    expect(mouth.from * table.length + mouth.length).toBeGreaterThan(station.to * table.length)
  })

  it('drops inside the cone, clear of its wall', () => {
    const drop = track.mechanics!.find((m) => m.kind === 'dropTrack')!
    for (const t of [drop.from, (drop.from + drop.to) / 2, drop.to]) {
      const p = curve.getPointAt(t)
      expect(fromAxis(p)).toBeLessThan(coneRadius(p.y - VOLCANO_BASE_Y) - 100)
    }
  })

  it('crosses the flank twice, in at the top of the lift and out near its foot, through holes in the rock', () => {
    const holes = coneCrossings(table, VOLCANO_BASE_Y)
    expect(holes).toHaveLength(2)
    for (const h of holes) {
      expect(h.y).toBeGreaterThan(VOLCANO_BASE_Y + 20)
      expect(h.y).toBeLessThan(VOLCANO_BASE_Y + VOLCANO.height / 2)
    }
  })
})
