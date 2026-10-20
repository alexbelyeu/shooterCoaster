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
 * The barrel points straight at the aim point, except that its on-screen
 * heading (radians clockwise from screen-up) stays at least this far from
 * vertical. A gun pointing straight up the screen is seen end-on and loses its
 * silhouette, so aims inside that narrow cone snap to its nearer edge.
 */
export const WEAPON_MIN_TILT = 0.15 // ≈ 8.6°
/** Aims further below the pivot than this heading (radians from up) are clamped to it. */
export const WEAPON_MAX_TILT = (2 * Math.PI) / 3 // 120°
/**
 * Aims closer to the pivot than this (fraction of the viewport's short side)
 * are pushed out along the same heading, so the gun keeps a side-on silhouette
 * instead of pointing into the screen. The heading, and so the barrel's
 * on-screen direction, is unchanged.
 */
export const WEAPON_MIN_AIM_DIST = 0.4

/**
 * Screen-space aim target for the gun (px, origin top-left): the aim point,
 * with its heading from the pivot kept between WEAPON_MIN_TILT and
 * WEAPON_MAX_TILT of straight up (on the same side) and its distance at least
 * `minDistPx`. Writes into `out`.
 */
export function clampWeaponAim(
  pivotX: number, pivotY: number, aimX: number, aimY: number, minDistPx: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  const dx = aimX - pivotX
  const up = pivotY - aimY // screen y grows downward
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

/** Writes the placement for a `width` x `height` viewport into `out`. */
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

/** World units per model unit when the pivot sits at the default depth. */
export const WEAPON_WORLD_SCALE = 3
/** Never put the pivot closer than this (camera near plane is 1). */
export const WEAPON_MIN_DEPTH = 2.6

export interface WeaponDepth {
  /** Pivot depth, camera space, positive. */
  depth: number
  /** World units per model unit. */
  scale: number
}

/**
 * Pivot depth and world scale that make one model unit `unitPx` tall on a
 * viewport `heightPx` high with vertical FOV `fovDeg`. Writes into `out`.
 */
export function weaponDepth(unitPx: number, heightPx: number, fovDeg: number, out: WeaponDepth): WeaponDepth {
  const tanHalf = Math.tan(((fovDeg || 80) * Math.PI) / 360)
  const worldPerPxAtUnitDepth = (2 * tanHalf) / Math.max(1, heightPx)
  out.depth = Math.max(WEAPON_MIN_DEPTH, WEAPON_WORLD_SCALE / (unitPx * worldPerPxAtUnitDepth))
  out.scale = unitPx * worldPerPxAtUnitDepth * out.depth
  return out
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
