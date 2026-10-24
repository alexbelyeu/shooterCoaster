/**
 * Field-of-view helpers for the coaster camera (pure, unit-tested).
 *
 * three.js PerspectiveCamera.fov is the *vertical* FOV. With a fixed 80° vertical
 * FOV a portrait phone (aspect ~0.46) only sees ~42° horizontally, which crops
 * enemies off the sides of the track. On narrow screens we widen the vertical FOV
 * just enough to keep a minimum horizontal FOV, clamped so it never gets
 * fish-eyed. Landscape / desktop screens already exceed the minimum and keep the
 * level's base FOV unchanged.
 */

/** Horizontal FOV (degrees) that narrow screens are widened towards. */
export const MIN_HORIZONTAL_FOV = 60
/** Upper bound on the widened vertical FOV (degrees). */
export const MAX_VERTICAL_FOV = 100

const DEG = Math.PI / 180

/** Horizontal FOV (degrees) for a vertical FOV (degrees) at an aspect (w / h). */
export function horizontalFov(verticalFovDeg: number, aspect: number): number {
  return (2 * Math.atan(Math.tan((verticalFovDeg * DEG) / 2) * aspect)) / DEG
}

/** Vertical FOV (degrees) that gives a horizontal FOV (degrees) at an aspect (w / h). */
export function verticalFovFor(horizontalFovDeg: number, aspect: number): number {
  return (2 * Math.atan(Math.tan((horizontalFovDeg * DEG) / 2) / aspect)) / DEG
}

/**
 * Vertical FOV to use for a screen: the base FOV, widened on narrow screens so
 * the horizontal FOV is at least `minHorizontal`, never above `maxVertical`
 * (and never below the base). Invalid aspects fall back to the base FOV.
 */
export function fovForAspect(
  baseVerticalFov: number,
  aspect: number,
  minHorizontal = MIN_HORIZONTAL_FOV,
  maxVertical = MAX_VERTICAL_FOV,
): number {
  if (!(aspect > 0) || !Number.isFinite(aspect)) return baseVerticalFov
  if (horizontalFov(baseVerticalFov, aspect) >= minHorizontal) return baseVerticalFov
  const needed = verticalFovFor(minHorizontal, aspect)
  return Math.max(baseVerticalFov, Math.min(needed, maxVertical))
}

/** Extra vertical FOV (degrees) at top speed on the 'full' Screen-shake setting (#123). */
export const SPEED_FOV_DEG = 5

/**
 * The screen's FOV (from `fovForAspect`) widened with speed: `speedNorm` 0–1 times
 * `scale` (the Screen-shake setting) of SPEED_FOV_DEG, never past `maxVertical`, so
 * portrait screens already at the cap keep their FOV.
 */
export function fovWithSpeed(
  screenFov: number,
  speedNorm: number,
  scale: number,
  maxVertical = MAX_VERTICAL_FOV,
): number {
  const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0)
  const kick = SPEED_FOV_DEG * clamp01(speedNorm) * clamp01(scale)
  return Math.max(screenFov, Math.min(screenFov + kick, maxVertical))
}
