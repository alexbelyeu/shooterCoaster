/**
 * Touch aim assist (pure, unit-tested; no three.js / React imports).
 *
 * A fingertip covers the target it is tapping and is far less precise than a
 * mouse, so a touch shot snaps to the nearest enemy whose screen position is
 * within TOUCH_ASSIST_RADIUS_PX of the touch point (≈ Apple's 44 pt minimum
 * hit target), and touch bullets get a slightly larger hit radius. Mouse and pen
 * aim are left exactly as they are.
 */
import type { PointerKind } from '@/input/pointerInput'

/** Snap radius around a touch point, in CSS px. */
export const TOUCH_ASSIST_RADIUS_PX = 44
/** Hit-radius multiplier for bullets fired by touch (1 = exact). */
export const TOUCH_HIT_SCALE = 1.25
/** Weapon pickups snap from a shorter reach and lose a tie to an enemy (#185). */
export const PICKUP_ASSIST_WEIGHT = 0.6

/** Snap radius (CSS px) for a pointer kind; 0 = no assist. */
export function assistRadiusPx(kind: PointerKind): number {
  return kind === 'touch' ? TOUCH_ASSIST_RADIUS_PX : 0
}

/** Bullet hit-radius multiplier for a pointer kind. */
export function hitScaleFor(kind: PointerKind): number {
  return kind === 'touch' ? TOUCH_HIT_SCALE : 1
}

/**
 * Index of the candidate screen point nearest to (px, py) within `radiusPx`,
 * or -1 if none is that close. `xs` / `ys` hold `count` candidate points;
 * `weights` (default 1 each) scale a candidate's reach: distances are divided by them.
 */
export function pickAssistTarget(
  px: number,
  py: number,
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  count: number,
  radiusPx: number,
  weights?: ArrayLike<number>,
): number {
  if (!(radiusPx > 0)) return -1
  let best = -1
  let bestSq = radiusPx * radiusPx
  for (let i = 0; i < count; i++) {
    const dx = xs[i] - px
    const dy = ys[i] - py
    const w = weights ? weights[i] : 1
    const d = (dx * dx + dy * dy) / (w * w)
    if (d <= bestSq) {
      bestSq = d
      best = i
    }
  }
  return best
}
