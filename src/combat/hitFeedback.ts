/**
 * Shared tuning + helpers for the combat hit-feedback pack (issue #14):
 * muzzle flash + tracer, hitmarker, enemy hit flash / kill pop.
 *
 * Events (all on `eventBus`):
 *   'weapon:fire'   — no payload; a bullet actually left the barrel.
 *   'enemy:hit'     — EnemyHitEvent (reused object, read synchronously).
 *   'enemy:killed'  — EnemyKilledEvent, emitted after the kill pop (LevelAudio plays the kill sound from it).
 *
 * Durations are in *game* milliseconds: consumers advance them with
 * `delta * timeScale` so slow-mo stretches them.
 */
import type * as THREE from 'three'
import type { KillSound } from '@/audio/sfxDesign'
import type { WeaponId } from './weapons/weaponTypes'

export interface EnemyKilledEvent {
  position: THREE.Vector3
  combo: number
  multiplier: number
  score: number
  /** An enemy's kill timbre (its death style's). */
  sound?: KillSound
  /** A boss weak point's id instead: the engine picks that part's sound. */
  bossPart?: string
}

/** Muzzle flash lifetime. */
export const MUZZLE_FLASH_MS = 60
/** Enemy white flash + 1.2x pop between the hit and the explosion. */
export const ENEMY_HIT_FLASH_MS = 80
export const KILL_POP_SCALE = 1.2

/** NDC aim point and weapon of the last shot; set by `fireAtNDC` just before 'weapon:fire'. */
export const lastShot: { x: number; y: number; weapon: WeaponId } = { x: 0, y: 0, weapon: 'blaster' }

export function recordShot(ndcX: number, ndcY: number, weapon: WeaponId = 'blaster'): void {
  lastShot.x = ndcX
  lastShot.y = ndcY
  lastShot.weapon = weapon
}

/** Camera-space muzzle tip, set every frame by `WeaponViewModel`; BulletPool draws fresh bullets from it. */
export const muzzleTip = { x: 0, y: 0, z: 0, ready: false }

/** Test-only (e2e `holdFeedback`): freeze transient feedback at its peak for slow headless screenshots. */
export function isFeedbackHeld(): boolean {
  return typeof window !== 'undefined' && window.__SC_TEST__?.holdFeedback === true
}
