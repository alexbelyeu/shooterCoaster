/**
 * Photo mode's camera (#828), pure: an orbit round the seat's eye at the pause moment, clamped so the camera never
 * goes under the terrain, out of an interior's walls or far into the fog. `PhotoCamera.tsx` drives it.
 */

// Type only: spawnPlacement's code would follow photo mode's UI into its lazy chunk.
import type { PlacementBounds } from '@/entities/spawning/spawnPlacement'

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** Where the camera sits round the pivot: `yaw` round world up (0 on +X), `pitch` above the pivot's level, `radius` out. */
export interface PhotoOrbit {
  yaw: number
  pitch: number
  radius: number
}

export interface PhotoLimits {
  minRadius: number
  maxRadius: number
  /** The camera's least height over the terrain. */
  clearance: number
}

/** Pitch range (rad): a little below the seat, up to a steep look down; short of straight down, so `lookAt` stays stable. */
export const PHOTO_MIN_PITCH = -0.35
export const PHOTO_MAX_PITCH = 1.35
/** The opening shot: just behind and above the seat, looking where the ride looked. */
export const PHOTO_START_PITCH = 0.3
export const PHOTO_START_RADII = 4
/** Radius bounds in rider eye heights, and the furthest out as a share of the fog's far distance. */
export const PHOTO_MIN_RADII = 0.8
export const PHOTO_MAX_RADII = 30
export const PHOTO_MAX_FOG_SHARE = 0.25
/** Drag: radians per CSS pixel. Stick: radians a second at full deflection. Zoom: radius ×e per second / per 1000 wheel px. */
export const PHOTO_DRAG_RAD_PER_PX = 0.006
export const PHOTO_STICK_RAD_PER_S = 2
export const PHOTO_ZOOM_PER_S = 1.5
export const PHOTO_WHEEL_PER_PX = 0.0015

/** The radius range and ground clearance for a level, from its rider eye height and fog far distance. */
export function photoLimits(eyeHeight: number, fogFar: number): PhotoLimits {
  const minRadius = eyeHeight * PHOTO_MIN_RADII
  const maxRadius = Math.max(minRadius, Math.min(eyeHeight * PHOTO_MAX_RADII, fogFar * PHOTO_MAX_FOG_SHARE))
  return { minRadius, maxRadius, clearance: eyeHeight * 0.5 }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** The opening orbit for a ride camera looking along `look`: behind the seat on that heading, a little above. */
export function startOrbit(look: Vec3, limits: PhotoLimits, out: PhotoOrbit): PhotoOrbit {
  const flat = Math.hypot(look.x, look.z)
  // Straight up or down (a loop's top): any heading will do.
  out.yaw = flat > 1e-6 ? Math.atan2(-look.z, -look.x) : 0
  out.pitch = PHOTO_START_PITCH
  out.radius = clamp((limits.minRadius / PHOTO_MIN_RADII) * PHOTO_START_RADII, limits.minRadius, limits.maxRadius)
  return out
}

/** Turn and zoom the orbit: `zoom` multiplies the radius (> 1 out); pitch and radius stay in range, yaw wraps. */
export function stepOrbit(orbit: PhotoOrbit, dYaw: number, dPitch: number, zoom: number, limits: PhotoLimits): PhotoOrbit {
  const yaw = orbit.yaw + dYaw
  orbit.yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw))
  orbit.pitch = clamp(orbit.pitch + dPitch, PHOTO_MIN_PITCH, PHOTO_MAX_PITCH)
  orbit.radius = clamp(orbit.radius * (zoom > 0 && Number.isFinite(zoom) ? zoom : 1), limits.minRadius, limits.maxRadius)
  return orbit
}

/**
 * The camera's position for `orbit` round `pivot`, written to `out`: lifted to `clearance` over the ground where the
 * orbit would go under it, then moved inside an interior's `bounds`. The camera looks at the pivot from there.
 */
export function orbitPosition(
  pivot: Vec3,
  orbit: PhotoOrbit,
  limits: PhotoLimits,
  groundFn: (x: number, z: number) => number,
  bounds: PlacementBounds | undefined,
  out: Vec3,
): Vec3 {
  const c = Math.cos(orbit.pitch)
  out.x = pivot.x + orbit.radius * c * Math.cos(orbit.yaw)
  out.y = pivot.y + orbit.radius * Math.sin(orbit.pitch)
  out.z = pivot.z + orbit.radius * c * Math.sin(orbit.yaw)
  if (bounds) {
    out.x = clamp(out.x, bounds.minX, bounds.maxX)
    out.y = Math.min(out.y, bounds.maxY)
    out.z = clamp(out.z, bounds.minZ, bounds.maxZ)
  }
  const floor = groundFn(out.x, out.z) + limits.clearance
  if (out.y < floor) out.y = floor
  return out
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** `scoaster-<level>-<YYYYMMDD-HHMMSS>.png`, local time. */
export function photoFileName(levelId: string, at: Date): string {
  const day = `${at.getFullYear()}${pad2(at.getMonth() + 1)}${pad2(at.getDate())}`
  const time = `${pad2(at.getHours())}${pad2(at.getMinutes())}${pad2(at.getSeconds())}`
  return `scoaster-${levelId}-${day}-${time}.png`
}
