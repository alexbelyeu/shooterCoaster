/**
 * Screen placement + recoil tuning for the first-person weapon view-model
 * (issue #65). Pure (no React / three) so it is unit-tested in plain Node.
 *
 * The gun is anchored bottom-right and sized from the viewport's short side, so
 * it reads the same on desktop, phone portrait and phone landscape while staying
 * clear of the screen centre (the aim area) and the HUD (top panels, combo meter
 * at bottom-centre, pause bottom-left, mute bottom-right corner).
 */

export interface WeaponLayout {
  /** Gun pivot (receiver centre), CSS px from the viewport's top-left. */
  x: number
  y: number
  /** Screen size of one model unit at the pivot depth, CSS px. */
  unitPx: number
}

/**
 * Placement, as fractions of the viewport's short side: pivot distance from the
 * right / bottom edges and the size of one model unit (the gun is ~1.2 units).
 * Portrait phones sit the gun higher and further right, between the combo
 * meter (bottom-centre) and the mute button (bottom-right corner).
 */
export const WEAPON_LANDSCAPE = { right: 0.5, bottom: 0.2, unit: 0.28 }
export const WEAPON_PORTRAIT = { right: 0.2, bottom: 0.48, unit: 0.28 }

/**
 * The gun's orientation target stays at least this far left of its pivot
 * (fraction of the short side), so it always reads as a diagonal silhouette
 * instead of pointing straight up the screen.
 */
export const WEAPON_MIN_LEAD = 0.6

export function weaponLayout(width: number, height: number): WeaponLayout {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const m = Math.min(w, h)
  const p = h > w ? WEAPON_PORTRAIT : WEAPON_LANDSCAPE
  return {
    x: w - m * p.right,
    y: h - m * p.bottom,
    unitPx: m * p.unit,
  }
}

/** World units per model unit when the pivot sits at the default depth. */
export const WEAPON_WORLD_SCALE = 3
/** Never put the pivot closer than this (camera near plane is 1). */
export const WEAPON_MIN_DEPTH = 2.6

/**
 * Pivot depth (camera space, positive) and world scale that make one model unit
 * `unitPx` tall on a viewport `heightPx` high with vertical FOV `fovDeg`.
 */
export function weaponDepth(unitPx: number, heightPx: number, fovDeg: number): { depth: number; scale: number } {
  const tanHalf = Math.tan(((fovDeg || 80) * Math.PI) / 360)
  const worldPerPxAtUnitDepth = (2 * tanHalf) / Math.max(1, heightPx)
  const depth = Math.max(WEAPON_MIN_DEPTH, WEAPON_WORLD_SCALE / (unitPx * worldPerPxAtUnitDepth))
  return { depth, scale: unitPx * worldPerPxAtUnitDepth * depth }
}

/** Recoil: the weapon (never the camera) kicks back and up, then settles. */
export const WEAPON_RECOIL_MS = 110
export const WEAPON_RECOIL_BACK = 0.12 // model units
export const WEAPON_RECOIL_PITCH = 0.16 // radians
/** Tracer streak lifetime and length (world units along the shot ray). */
export const TRACER_MS = 90
export const TRACER_RANGE = 160
/** How long the gun keeps pointing at the last shot's aim point before following the pointer again. */
export const SHOT_AIM_HOLD_MS = 300

/** Recoil envelope 1 → 0 from the remaining time: fast snap back, soft settle. */
export function recoilEnvelope(remainingMs: number): number {
  const t = Math.min(Math.max(remainingMs / WEAPON_RECOIL_MS, 0), 1)
  return t * t * (3 - 2 * t)
}
