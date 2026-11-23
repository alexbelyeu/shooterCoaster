import { describe, expect, it } from 'vitest'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { buildArcTable } from '@/track/arcLength'
import { rideModel } from '@/track/ridePhysics'
import { BEAT_TOLERANCE_SECONDS } from '@/track/rideV2'
import { getTrackDimensions } from '@/track/trackDimensions'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { createHeightFunction } from '@/utils/terrainNoise'
import type { TrackParams } from '@/types/level'
import { PYRAMID_BASE_SIZE, PYRAMID_SHRINK } from '../../landmarkDimensions'
import { MESA_FOOTPRINT } from './desertLayout'
import { buildDesertRide, DESERT_TRACK, PYRAMID_BASE_Y } from './desertTrack'
import { CANYON, CANYON_MESAS, PYRAMID_PASSAGE, PYRAMID_PASSAGE_FLOOR, RIDE_FRAME, rideFrameToWorld } from './landmarks'

/** `rideFrameToWorld`'s inverse. */
const toRideFrame = ({ x, y = 0, z }: { x: number; y?: number; z: number }) => ({
  x: x * RIDE_FRAME.cos - z * RIDE_FRAME.sin,
  y,
  z: x * RIDE_FRAME.sin + z * RIDE_FRAME.cos,
})

const PASSAGE_HALF = (PYRAMID_BASE_SIZE * PYRAMID_SHRINK ** PYRAMID_PASSAGE.layer) / 2
const PASSAGE_FLOOR_Y = PYRAMID_BASE_Y + PYRAMID_PASSAGE_FLOOR

describe.each([
  ['as shipped', getLevelConfig('level2')!.track],
  ['as authored', DESERT_TRACK],
] as [string, TrackParams][])("level 2's ride (#864), %s", (_name, track) => {
  const curve = createTrackCurve(track)
  const table = buildArcTable(curve)
  const plan = rideModel(track, table).plan!
  const { eyeHeight, railGauge } = getTrackDimensions(track)
  const sample = (from: number, to: number, n = 400) =>
    Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n).map((t) => toRideFrame(curve.getPointAt(t)))

  it('lands every storyboard beat on its second', () => {
    const want = track.ride === 'v2' ? track.rideV2!.beats!.map((b) => b.second) : []
    expect(plan.landed.length).toBe(want.length)
    plan.landed.forEach((s, i) => expect(Math.abs(s - want[i])).toBeLessThanOrEqual(BEAT_TOLERANCE_SECONDS))
  })

  it("has the kit's elements: a station launch, a lift hill, the doorway's near miss, a jump gap and airtime", () => {
    const kinds = buildDesertRide().markers.map((m) => m.kind)
    for (const k of ['liftHill', 'headChopper', 'airtimeHill', 'bankedTurn'] as const) expect(kinds).toContain(k)
    expect(track.mechanics?.map((m) => m.kind)).toEqual(['station', 'jumpGap'])
  })

  it('drops at least 60° off the lift', () => {
    let steepest = 0
    for (let i = 1; i < table.count && table.s[i] < table.length / 3; i++) {
      const ds = table.s[i] - table.s[i - 1]
      if (ds > 0) steepest = Math.max(steepest, Math.asin(Math.min(1, (table.y[i - 1] - table.y[i]) / ds)))
    }
    expect((steepest * 180) / Math.PI).toBeGreaterThanOrEqual(60)
  })

  it('rides the dark passage inside the doorway: rails over its floor, the eye under its lintel', () => {
    const dark = track.darkSections![0]
    const inside = sample(dark.from, dark.to - dark.ramp).filter((p) => Math.abs(p.x - RIDE_FRAME.pyramidX) <= PASSAGE_HALF)
    expect(inside.length).toBeGreaterThan(100)
    for (const p of inside) {
      expect(Math.abs(p.z) + railGauge / 2).toBeLessThan(PYRAMID_PASSAGE.width / 2)
      expect(p.y).toBeGreaterThan(PASSAGE_FLOOR_Y)
      expect(p.y + eyeHeight).toBeLessThan(PASSAGE_FLOOR_Y + PYRAMID_PASSAGE.height)
    }
  })

  it('jumps the canyon between its two mesas, their footprints clear of the flight', () => {
    const jump = track.mechanics!.find((m) => m.kind === 'jumpGap')!
    const [off, on] = [jump.from, jump.to].map((t) => toRideFrame(curve.getPointAt(t)))
    expect(off.x).toBeGreaterThan(CANYON.x)
    expect(on.x).toBeLessThan(CANYON.x)
    for (const p of [off, on]) expect(Math.abs(p.z - CANYON.z)).toBeLessThan(10)
    const sides = CANYON_MESAS.map(toRideFrame).map((m) => {
      expect(Math.abs(m.z - off.z)).toBeGreaterThan(MESA_FOOTPRINT)
      return Math.sign(m.z - off.z)
    })
    expect(sides[0]).toBe(-sides[1])
  })

  it('keeps its rails over the natural ground but in the dunes\' cut to the west door, at most 120 deep', () => {
    const ground = createHeightFunction('desert')
    const inCut = (p: { x: number; z: number }) => Math.abs(p.z) < 1 && p.x > RIDE_FRAME.pyramidX - PASSAGE_HALF - 400 && p.x < RIDE_FRAME.pyramidX
    let outside = Infinity
    let cut = Infinity
    for (const p of sample(0, 1, 2000)) {
      const w = rideFrameToWorld(p)
      const over = p.y - ground(w.x, w.z)
      if (inCut(p)) cut = Math.min(cut, over)
      else outside = Math.min(outside, over)
    }
    expect(outside).toBeGreaterThan(-5)
    expect(cut).toBeGreaterThan(-120)
  })
})
