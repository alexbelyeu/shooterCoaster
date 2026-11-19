import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { RUN_SECONDS } from '@/levels/pacing'
import { createTrackCurve } from './curves/createTrackCurve'
import { buildArcTable, distanceAtT } from './arcLength'
import { rideProfile, rideSpeeds, riddenBetween } from './ridePhysics'
import { PHOTO_MAX_SIDE, PHOTO_RUN_SHARE, passedPhoto, photoDistance, photoSize } from './photoMarker'

describe.each(getAllLevels().map((l) => [l.id, l.track] as const))('the on-ride photo on %s', (_id, track) => {
  const table = buildArcTable(createTrackCurve(track))
  const speeds = rideSpeeds(track)
  const at = photoDistance(table, track.photo, speeds, RUN_SECONDS)
  const profile = rideProfile(table, speeds, RUN_SECONDS)

  it('comes round inside the run, after GO', () => {
    expect(at).toBeGreaterThan(0)
    expect(at).toBeLessThan(riddenBetween(profile, 0, RUN_SECONDS - 1))
  })

  it('without a marker, at its share of the run', () => {
    if (track.photo !== undefined) {
      expect(at).toBeCloseTo(distanceAtT(table, track.photo))
      return
    }
    expect(at).toBeCloseTo(riddenBetween(profile, 0, RUN_SECONDS * PHOTO_RUN_SHARE), 0)
  })
})

describe('passedPhoto', () => {
  it('fires on the frame that rides past the marker, not on a jump onto or over it', () => {
    expect(passedPhoto(99, 101, 100, 1000)).toBe(true)
    expect(passedPhoto(99, 100, 100, 1000)).toBe(true)
    expect(passedPhoto(100, 101, 100, 1000)).toBe(false)
    expect(passedPhoto(90, 95, 100, 1000)).toBe(false)
    expect(passedPhoto(0, 200, 100, 1000)).toBe(false)
    expect(passedPhoto(101, 5, 100, 1000)).toBe(false)
  })
})

describe('photoSize', () => {
  it('caps the longer side and keeps the aspect, never scaling up', () => {
    expect(photoSize(2560, 1440)).toEqual({ width: PHOTO_MAX_SIDE, height: 720 })
    expect(photoSize(780, 1688)).toEqual({ width: 591, height: PHOTO_MAX_SIDE })
    expect(photoSize(800, 450)).toEqual({ width: 800, height: 450 })
  })
})
