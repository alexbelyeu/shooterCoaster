import type { EnemyType } from '@/types/level'

/** Each enemy's smallest typical on-screen extent in world units after its model scale: what the player has to resolve. */
export const ENEMY_SILHOUETTE: Record<EnemyType | 'goldenBalloon', number> = {
  balloon: 60, // sphere r=30
  goldenBalloon: 60,
  crow: 64, // body ~72 long, wings span ~180 when open
  scorpion: 48, // body ~52 long x 24 wide, plus tail
  shark: 60, // r=2.8 x10 wide, ~120 long
  jellyfish: 42, // dome r=3 x7
  flyingFish: 40, // body ~44 long, wings ~88
  snowman: 65, // 1.3x the base model: 52 wide x 94 tall
  snowmanScout: 48, // 0.9x the base model
  snowmanBrute: 90, // 1.8x the base model
  emberWisp: 48, // core r=3 x8
  lavaGolem: 108, // 12 wide x9, 180 tall
  fireImp: 52, // 6.4 wide x8, 64 tall
  infernalDrake: 140, // body ~7 x20, wings far wider
}

/** Px at 1280x720 an enemy must reach during the ride; `READABLE_PX` in e2e/smoke.mjs mirrors it. */
export const MIN_ENEMY_PX = 12
/** Reference viewport height + vertical FOV (CoasterCamera BASE_FOV). */
export const REFERENCE_VIEWPORT_H = 720
export const REFERENCE_FOV_DEG = 80

/** Projected size in px of `worldSize` at `distance` for the given viewport/FOV. */
export function projectedPx(
  worldSize: number,
  distance: number,
  viewportH = REFERENCE_VIEWPORT_H,
  fovDeg = REFERENCE_FOV_DEG,
): number {
  const halfTan = Math.tan((fovDeg * Math.PI) / 360)
  return (worldSize * viewportH) / (2 * halfTan * Math.max(distance, 1e-3))
}

/** Farthest camera distance at which this enemy is still ≥ MIN_ENEMY_PX on the reference viewport. */
export function maxReadableDistance(type: EnemyType | 'goldenBalloon'): number {
  const halfTan = Math.tan((REFERENCE_FOV_DEG * Math.PI) / 360)
  return (ENEMY_SILHOUETTE[type] * REFERENCE_VIEWPORT_H) / (2 * halfTan * MIN_ENEMY_PX)
}
