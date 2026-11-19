import { distanceAtT, type ArcTable } from './arcLength'
import { rideProfile, riddenBetween, type RideSpeeds } from './ridePhysics'

/** A track without a `photo` marker takes its photo this far into the run (#701): late, before the end. */
export const PHOTO_RUN_SHARE = 0.85
/** The photo's longer side, px: enough for the story card's 1080 px art. */
export const PHOTO_MAX_SIDE = 1280
/** A ride step longer than this share of the track is a jump (a new run, the smoke's `rideTo`), never a pass. */
const MAX_PASS_SHARE = 0.05

/**
 * Arc distance of the on-ride photo: the track's `photo` marker (a track fraction), else where the ride is
 * `PHOTO_RUN_SHARE` of the way through a `runSeconds` run (every lap is longer than a run, so a share of the lap could
 * never come round).
 */
export function photoDistance(table: ArcTable, photo: number | undefined, speeds: RideSpeeds, runSeconds: number): number {
  if (photo !== undefined) return distanceAtT(table, photo)
  const seconds = runSeconds * PHOTO_RUN_SHARE
  return riddenBetween(rideProfile(table, speeds, seconds), 0, seconds) % table.length
}

/** True when the ride passed arc distance `at` between two frames at `prev` and `now`. */
export function passedPhoto(prev: number, now: number, at: number, trackLength: number): boolean {
  return prev < at && now >= at && now - prev <= trackLength * MAX_PASS_SHARE
}

/** The photo's pixel size for a `width` × `height` canvas: its longer side at most `PHOTO_MAX_SIDE`, never scaled up. */
export function photoSize(width: number, height: number): { width: number; height: number } {
  const k = Math.min(1, PHOTO_MAX_SIDE / Math.max(width, height, 1))
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) }
}

/** Bus event on the frame the photo is taken: the HUD's flash and the shutter sound. */
export const RIDE_PHOTO_EVENT = 'ride:photo'
