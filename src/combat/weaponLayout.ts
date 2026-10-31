/** Screen placement, aim and recoil tuning for the first-person weapon (#65). Pure, so it runs in plain Node tests. */
import type { WeaponId } from './weapons/weaponTypes'

export interface WeaponLayout {
  /** Gun pivot, CSS px from the viewport's top-left. */
  x: number
  y: number
  /** Screen size of one model unit at the pivot depth, CSS px. */
  unitPx: number
}

/**
 * Fractions of the viewport's short side: pivot distance from the right / bottom
 * edges and one model unit. Portrait sits high enough that the gun clears the bottom
 * row (pause, combo meter, mute) at any aim on phones 320 px wide and up (#223).
 */
export const WEAPON_LANDSCAPE = { right: 0.5, bottom: 0.2, unit: 0.28 }
export const WEAPON_PORTRAIT = { right: 0.2, bottom: 0.54, unit: 0.28 }

/** Min on-screen heading from straight up (rad): pointing straight up, the gun is seen end-on. */
export const WEAPON_MIN_TILT = 0.15
/** Max heading from straight up (rad) for aims below the pivot. */
export const WEAPON_MAX_TILT = (2 * Math.PI) / 3
/** Min pivot→aim distance (fraction of the short side); closer aims would point the gun into the screen. */
export const WEAPON_MIN_AIM_DIST = 0.4

/**
 * Where the gun points on screen (px): the aim point, with its heading from the
 * pivot clamped to [WEAPON_MIN_TILT, WEAPON_MAX_TILT] on the same side and its
 * distance at least `minDistPx`. Distance changes keep the heading, so the
 * barrel and the tracer stay collinear.
 */
export function clampWeaponAim(
  pivotX: number, pivotY: number, aimX: number, aimY: number, minDistPx: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  const dx = aimX - pivotX
  const up = pivotY - aimY
  const heading = Math.atan2(dx, up)
  const side = heading > 0 ? 1 : -1
  const h = side * Math.min(Math.max(Math.abs(heading), WEAPON_MIN_TILT), WEAPON_MAX_TILT)
  const dist = Math.hypot(dx, up)
  if (h === heading && dist >= minDistPx) {
    out.x = aimX
    out.y = aimY
    return out
  }
  const d = Math.max(dist, minDistPx, 1)
  out.x = pivotX + Math.sin(h) * d
  out.y = pivotY - Math.cos(h) * d
  return out
}

export function weaponLayout(width: number, height: number, out: WeaponLayout): WeaponLayout {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const m = Math.min(w, h)
  const p = h > w ? WEAPON_PORTRAIT : WEAPON_LANDSCAPE
  out.x = w - m * p.right
  out.y = h - m * p.bottom
  out.unitPx = m * p.unit
  return out
}

/** World units per model unit at the default depth. */
export const WEAPON_WORLD_SCALE = 3
/** Closest pivot depth; the camera near plane is 1. */
export const WEAPON_MIN_DEPTH = 2.6

export interface WeaponDepth {
  /** Pivot depth, camera space, positive. */
  depth: number
  /** World units per model unit. */
  scale: number
}

/** Pivot depth and scale that make one model unit `unitPx` tall at vertical FOV `fovDeg`. */
export function weaponDepth(unitPx: number, heightPx: number, fovDeg: number, out: WeaponDepth): WeaponDepth {
  const tanHalf = Math.tan(((fovDeg || 80) * Math.PI) / 360)
  const worldPerPxAtUnitDepth = (2 * tanHalf) / Math.max(1, heightPx)
  out.depth = Math.max(WEAPON_MIN_DEPTH, WEAPON_WORLD_SCALE / (unitPx * worldPerPxAtUnitDepth))
  out.scale = unitPx * worldPerPxAtUnitDepth * out.depth
  return out
}

export const WEAPON_RECOIL_MS = 110
export const WEAPON_RECOIL_BACK = 0.12 // model units
export const WEAPON_RECOIL_PITCH = 0.16 // radians
/** Recoil kick per weapon: the rapid gun's lighter shots kick less. */
export const WEAPON_RECOIL_SCALE: Record<WeaponId, number> = { blaster: 1, spread: 1.3, rapid: 0.55, piercing: 1.15 }
export const TRACER_MS = 90
/** Tracer length, world units along the shot ray. */
export const TRACER_RANGE = 160
/** How long the gun keeps pointing at the last shot before following the pointer again. */
export const SHOT_AIM_HOLD_MS = 300

/** Recoil envelope 1 → 0 from the remaining time (smoothstep). */
export function recoilEnvelope(remainingMs: number): number {
  const t = Math.min(Math.max(remainingMs / WEAPON_RECOIL_MS, 0), 1)
  return t * t * (3 - 2 * t)
}
