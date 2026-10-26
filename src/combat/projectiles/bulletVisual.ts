/**
 * Where a bullet is drawn and how big (#165); its hit test stays on the camera ray (`bulletMotion.ts`).
 * It is drawn from the muzzle into that ray by the tracer's end, capped on screen so it never fills the lens.
 */
import { TRACER_RANGE } from '../weaponLayout'

export const BULLET_RADIUS_PER_SIZE = 0.1

export const BULLET_MERGE_DIST = TRACER_RANGE

/** Under the smoke's 2% so off-axis stretching stays inside it. */
export const BULLET_MAX_SCREEN_FRAC = 0.015

/** Share of the muzzle → ray offset still drawn after flying `travelled` units. */
export function muzzleOffsetWeight(travelled: number): number {
  if (travelled >= BULLET_MERGE_DIST) return 0
  return 1 - Math.max(travelled, 0) / BULLET_MERGE_DIST
}

/** Screen radius as a fraction of the canvas height. */
export function screenRadiusFraction(radius: number, depth: number, tanHalfFov: number): number {
  return depth > 0 ? radius / (2 * depth * tanHalfFov) : Infinity
}

export function drawnBulletRadius(fullRadius: number, depth: number, tanHalfFov: number): number {
  return Math.min(fullRadius, BULLET_MAX_SCREEN_FRAC * 2 * Math.max(depth, 0) * tanHalfFov)
}
