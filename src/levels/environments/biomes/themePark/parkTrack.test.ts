import { describe, expect, it } from 'vitest'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { buildArcTable } from '@/track/arcLength'
import { rideModel } from '@/track/ridePhysics'
import { BEAT_TOLERANCE_SECONDS } from '@/track/rideV2'
import { eyeClearance } from '@/track/elements/headChopper'
import { getTrackDimensions } from '@/track/trackDimensions'
import { buildParkRide, PARK_TRACK } from './parkTrack'
import { RIDES } from './parkSpec'

const curve = createTrackCurve(PARK_TRACK)
const table = buildArcTable(curve)
const plan = rideModel(PARK_TRACK, table).plan!
const eye = getTrackDimensions(PARK_TRACK).eyeHeight

/** The small Ferris wheel as drawn (`FerrisWheel.tsx`): its rim and the gondolas hanging off it, 8 units deep, on flat ground. */
const wheel = RIDES.find((r) => r.kind === 'ferrisWheel' && r.radius === 60)!
const wheelBox = {
  min: { x: wheel.x - wheel.radius - 4, y: 0, z: wheel.z - 6 },
  max: { x: wheel.x + wheel.radius + 4, y: 2 * wheel.radius + 14, z: wheel.z + 6 },
}

describe("level 1's ride (#863)", () => {
  it('lands every storyboard beat on its second', () => {
    expect(plan.landed.length).toBe(PARK_TRACK.ride === 'v2' ? PARK_TRACK.rideV2?.beats?.length : -1)
    const want = PARK_TRACK.ride === 'v2' ? PARK_TRACK.rideV2!.beats!.map((b) => b.second) : []
    plan.landed.forEach((s, i) => expect(Math.abs(s - want[i])).toBeLessThanOrEqual(BEAT_TOLERANCE_SECONDS))
  })

  it('has the kit\'s elements: a station, two lift hills, airtime, a helix and the near miss', () => {
    const kinds = buildParkRide().markers.map((m) => m.kind)
    for (const k of ['station', 'liftHill', 'airtimeHill', 'slowMotion', 'helix', 'headChopper'] as const) expect(kinds).toContain(k)
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

  it('passes the small Ferris wheel close, but clear: the near miss', () => {
    const near = eyeClearance(curve, wheelBox, eye)
    expect(near).toBeGreaterThan(10)
    expect(near).toBeLessThan(4 * eye)
  })
})
