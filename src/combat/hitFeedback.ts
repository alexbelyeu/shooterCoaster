/**
 * Shared tuning + helpers for the combat hit-feedback pack (issue #14):
 * muzzle flash, hitmarker, enemy hit flash / kill pop and camera kick.
 *
 * Events (all on `eventBus`):
 *   'weapon:fire'   — no payload; a bullet actually left the barrel.
 *   'enemy:hit'     — EnemyHitEvent (reused object, read synchronously).
 *   'enemy:killed'  — { position, combo, score }, emitted after the kill pop.
 *
 * Durations are in *game* milliseconds: consumers advance them with
 * `delta * timeScale` so slow-mo stretches them.
 */
/** Muzzle flash lifetime. */
export const MUZZLE_FLASH_MS = 60
/** Enemy white flash + 1.2x pop between the hit and the explosion. */
export const ENEMY_HIT_FLASH_MS = 80
export const KILL_POP_SCALE = 1.2
/** Camera jitter on every shot (angular, ~1–2 px at 720p). */
export const FIRE_KICK_MS = 100
export const FIRE_KICK_RAD = 0.0035
/** Camera shake on kill, scaled by combo (capped at combo 10). */
export const KILL_SHAKE_MS = 220
export const KILL_SHAKE_COMBO_CAP = 10
/** Hard cap on how far the shake may displace the camera from the track. */
export const MAX_SHAKE_UNITS = 3

/**
 * Test-only: when the e2e hook sets `holdFeedback`, transient feedback (muzzle
 * flash, hitmarker) stays at its peak so a screenshot can capture it reliably
 * under slow software rendering. Always false in normal play.
 */
export function isFeedbackHeld(): boolean {
  // __SC_TEST__ only exists with ?e2e=1 (see src/testing/e2eHook.tsx).
  return typeof window !== 'undefined' && window.__SC_TEST__?.holdFeedback === true
}
