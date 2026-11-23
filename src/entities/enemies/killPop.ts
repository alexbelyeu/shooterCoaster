import type * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { useGameStore } from '@/store/useGameStore'
import { ENEMY_HIT_FLASH_MS, KILL_POP_SCALE, type EnemyKilledEvent } from '@/combat/hitFeedback'
import { getExplosionPool } from '@/effects/explosionPoolHandle'
import type { DeathStyle } from '@/effects/deathStyles'
import { flashMesh, restoreMesh } from './hitFlash'

/**
 * The one kill sequence (#220), shared by `EnemyBase` and `BossBase`'s weak points: scored on the hit, then a
 * white flash at `KILL_POP_SCALE` for `ENEMY_HIT_FLASH_MS` of game time, then `enemy:killed` and the death style's
 * burst. A pop holds one kill; `points` is its base score, before the combo multiplier.
 */
export interface KillPop {
  active: boolean
  ms: number
  frames: number
  points: number
}

/** What a kill adds to its `enemy:killed` payload beyond the score (see `EnemyKilledEvent`). */
export interface KillExtras {
  bossPart?: string
  big?: true
}

export function createKillPop(): KillPop {
  return { active: false, ms: 0, frames: 0, points: 0 }
}

/** Counts the kill for the combo and adds its base points. */
export function scoreKill(points: number): void {
  const store = useGameStore.getState()
  store.registerKill()
  store.addScore(points)
}

/** The hit: scored at once, `target` flashed white and popped. */
export function startKillPop(pop: KillPop, target: THREE.Object3D | null | undefined, points: number): void {
  scoreKill(points)
  pop.active = true
  pop.ms = ENEMY_HIT_FLASH_MS
  pop.frames = 0
  pop.points = points
  if (target) {
    target.traverse(flashMesh)
    target.scale.setScalar(KILL_POP_SCALE)
  }
}

/**
 * Ages the pop by `dt` s of game time; true when it is over. It needs a second tick too: the hit can land earlier
 * in the same frame (the bullet pool runs first), so the pop is always rendered at least once, even at very low
 * frame rates.
 */
export function tickKillPop(pop: KillPop, dt: number): boolean {
  if (!pop.active) return false
  pop.ms -= dt * 1000
  pop.frames += 1
  return pop.ms <= 0 && pop.frames >= 2
}

/** The pop's end: `target` restored, then the kill's event and burst at `position`. */
export function finishKillPop(
  pop: KillPop,
  target: THREE.Object3D | null | undefined,
  position: THREE.Vector3,
  style: DeathStyle,
  extras?: KillExtras,
): void {
  pop.active = false
  if (target) {
    target.traverse(restoreMesh)
    target.scale.setScalar(1)
  }
  emitKill(position, pop.points, style, extras)
}

/** `enemy:killed` at the combo of the moment, and `style`'s burst; for a kill already scored (`scoreKill`). */
export function emitKill(position: THREE.Vector3, points: number, style: DeathStyle, extras?: KillExtras): void {
  const { combo } = useGameStore.getState()
  const event: EnemyKilledEvent = {
    position,
    combo: combo.count,
    multiplier: combo.multiplier,
    score: Math.round(points * combo.multiplier),
    sound: style.sound,
    ...extras,
  }
  eventBus.emit('enemy:killed', event)
  getExplosionPool()?.explode(position, style)
}
