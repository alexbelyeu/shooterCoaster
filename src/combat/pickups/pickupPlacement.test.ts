import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { createTrigCurve } from '@/track/curves/TrigCurve'
import { createTrigCurve2 } from '@/track/curves/TrigCurve2'
import { getTrackDimensions, getTrackScale } from '@/track/trackDimensions'
import { TOUCH_HIT_SCALE } from '@/combat/aimAssist'
import {
  MAX_PICKUPS, MIN_PICKUPS, PICKUP_BOB, PICKUP_HEIGHT, PICKUP_HIT_RADIUS, PICKUP_RING_RADIUS, PICKUP_RING_TUBE,
  PICKUP_SPAN, placePickups,
} from './pickupPlacement'

const flat = (t: number) => ({ x: t * 1000, y: 10, z: 0 })

describe('placePickups', () => {
  it('places one of each by default, in order, spaced along the span, above the rails', () => {
    const spots = placePickups('level1', undefined, flat, 2)
    expect(spots.map((s) => s.id)).toEqual(['spread', 'rapid', 'piercing'])
    const slot = (PICKUP_SPAN[1] - PICKUP_SPAN[0]) / 3
    for (let i = 0; i < spots.length; i++) {
      expect(spots[i].t).toBeGreaterThan(PICKUP_SPAN[0] + slot * (i + 0.2))
      expect(spots[i].t).toBeLessThan(PICKUP_SPAN[0] + slot * (i + 0.8))
      expect(spots[i].position.y).toBe(10 + PICKUP_HEIGHT * 2)
      expect(spots[i].position.x).toBeCloseTo(spots[i].t * 1000)
    }
  })

  it('is the same every run of a level and differs between levels', () => {
    const a = placePickups('level2', undefined, flat, 1).map((s) => s.t)
    expect(placePickups('level2', undefined, flat, 1).map((s) => s.t)).toEqual(a)
    expect(placePickups('level3', undefined, flat, 1).map((s) => s.t)).not.toEqual(a)
  })

  it('takes at most four', () => {
    expect(placePickups('level1', ['spread', 'rapid', 'piercing', 'spread', 'rapid'], flat, 1)).toHaveLength(MAX_PICKUPS)
  })

  it('every level has 2–4 pickups at finite points on its track', () => {
    for (const level of getAllLevels()) {
      const { track } = level
      const curve = (track.curve === 'curve2' ? createTrigCurve2 : createTrigCurve)(track.varA, track.varB, track.varC, track.scalar)
      const spots = placePickups(level.id, level.pickups, (t) => curve.getPointAt(t), getTrackScale(track.scalar))
      expect(spots.length).toBeGreaterThanOrEqual(MIN_PICKUPS)
      expect(spots.length).toBeLessThanOrEqual(MAX_PICKUPS)
      for (const s of spots) expect(Number.isFinite(s.position.x + s.position.y + s.position.z)).toBe(true)
    }
  })

  it("every level keeps the passing rider's eye outside the pickup, its touch hit sphere and its ring", () => {
    for (const level of getAllLevels()) {
      const s = getTrackScale(level.track.scalar)
      const { eyeHeight } = getTrackDimensions(level.track)
      const lowestCentre = (PICKUP_HEIGHT - PICKUP_BOB) * s
      const reach = Math.max(PICKUP_HIT_RADIUS * TOUCH_HIT_SCALE, PICKUP_RING_RADIUS + PICKUP_RING_TUBE) * s
      expect(lowestCentre - eyeHeight, level.id).toBeGreaterThan(reach + 5 * s)
    }
  })
})
