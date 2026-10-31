import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { useGameStore } from '@/store/useGameStore'

export interface CollisionTarget {
  id: string
  getPosition: () => THREE.Vector3
  radiusSq: number
  onHit: () => void
  /** A weapon pickup (#185) is shot like an enemy but is no enemy: no `enemy:hit`, no hitmarker. */
  kind?: 'pickup'
  hitThisFrame: boolean
  /** Set with `hitThisFrame`: the bullet's first hit, so it counts for accuracy (a piercing bullet counts once). */
  firstHitThisFrame: boolean
}

/**
 * Payload of the `enemy:hit` event. A single object is reused for every hit so
 * the collision path never allocates — listeners must read it synchronously and
 * must not keep a reference to it (copy `position` if you need it later).
 */
export interface EnemyHitEvent {
  id: string
  position: THREE.Vector3
}

const targets = new Map<string, CollisionTarget>()
const hitEvent: EnemyHitEvent = { id: '', position: new THREE.Vector3() }

export function registerCollisionTarget(target: Omit<CollisionTarget, 'hitThisFrame' | 'firstHitThisFrame'>): void {
  targets.set(target.id, { ...target, hitThisFrame: false, firstHitThisFrame: false })
}

export function unregisterCollisionTarget(id: string): void {
  targets.delete(id)
}

export function getCollisionTargets(): Map<string, CollisionTarget> {
  return targets
}

/**
 * Resolve one hit on a target: count it for accuracy (`countHit`: a piercing bullet's
 * later hits don't), emit `enemy:hit` (UI / audio / feedback react to it), then run the
 * target's own hit handler. Used by the bullet pool's collision pass and by the e2e
 * test hook so both take the same path.
 */
export function processHit(target: CollisionTarget, countHit = true): void {
  if (countHit) useGameStore.getState().registerHit()
  if (target.kind === 'pickup') {
    target.onHit()
    return
  }
  hitEvent.id = target.id
  hitEvent.position.copy(target.getPosition())
  eventBus.emit('enemy:hit', hitEvent)
  target.onHit()
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    targets.clear()
  })
}
