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
import type { CollisionTarget } from './CollisionManager'

/** Snap radius around a touch point, in CSS px. */
export const TOUCH_ASSIST_RADIUS_PX = 44
/** Hit-radius multiplier for bullets fired by touch (1 = exact). */
export const TOUCH_HIT_SCALE = 1.25
/** Weapon pickups snap from a shorter reach and lose a tie to an enemy (#185). */
export const PICKUP_ASSIST_WEIGHT = 0.6

/** A target kind's reach for the snap: 0 never pulls toward it (a bystander, #518). */
export function assistWeight(kind: CollisionTarget['kind']): number {
  if (kind === 'bystander') return 0
  return kind === 'pickup' ? PICKUP_ASSIST_WEIGHT : 1
}

/** Snap radius (CSS px) for a pointer kind; 0 = no assist. */
export function assistRadiusPx(kind: PointerKind): number {
  return kind === 'touch' ? TOUCH_ASSIST_RADIUS_PX : 0
}

/** Bullet hit-radius multiplier for a pointer kind. */
export function hitScaleFor(kind: PointerKind): number {
  return kind === 'touch' ? TOUCH_HIT_SCALE : 1
}

/**
 * Index of the candidate screen point nearest to (px, py) within `radiusPx`, or -1.
 * `weights` (default 1) scale each candidate's reach; a weight of 0 is never picked.
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
    if (!(w > 0)) continue
    const d = (dx * dx + dy * dy) / (w * w)
    if (d <= bestSq) {
      bestSq = d
      best = i
    }
  }
  return best
}
