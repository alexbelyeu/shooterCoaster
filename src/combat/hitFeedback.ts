/**
 * Shared tuning + helpers for the combat hit-feedback pack (issue #14):
 * muzzle flash + tracer, hitmarker, enemy hit flash / kill pop.
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

/** NDC aim point and performance.now() of the last shot; set by `fireAtNDC` just before 'weapon:fire'. */
export const lastShot = { x: 0, y: 0, at: 0 }

export function recordShot(ndcX: number, ndcY: number): void {
  lastShot.x = ndcX
  lastShot.y = ndcY
  lastShot.at = typeof performance !== 'undefined' ? performance.now() : 0
}

/** Test-only (e2e `holdFeedback`): freeze transient feedback at its peak for slow headless screenshots. */
export function isFeedbackHeld(): boolean {
  return typeof window !== 'undefined' && window.__SC_TEST__?.holdFeedback === true
}
