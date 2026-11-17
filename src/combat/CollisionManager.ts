import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { useGameStore } from '@/store/useGameStore'

export interface CollisionTarget {
  id: string
  getPosition: () => THREE.Vector3
  radiusSq: number
  onHit: () => void
  /** A weapon pickup (#185) is shot like an enemy but is none: no `enemy:hit`. */
  kind?: 'pickup'
  hitThisFrame: boolean
  /** The hitting bullet's first target: only that hit counts for accuracy. */
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
/**
 * The same targets as an array, walked by index every frame (the bullets' hit test, aim assist): a `for…of` over
 * the map allocates an iterator per walk, and the hit test walked it once per live bullet (#596).
 */
const targetList: CollisionTarget[] = []

function removeFromList(target: CollisionTarget | undefined): void {
  const i = target ? targetList.indexOf(target) : -1
  if (i >= 0) targetList.splice(i, 1)
}
const hitEvent: EnemyHitEvent = { id: '', position: new THREE.Vector3() }

export function registerCollisionTarget(target: Omit<CollisionTarget, 'hitThisFrame' | 'firstHitThisFrame'>): void {
  const entry = { ...target, hitThisFrame: false, firstHitThisFrame: false }
  removeFromList(targets.get(target.id))
  targets.set(target.id, entry)
  targetList.push(entry)
}

export function unregisterCollisionTarget(id: string): void {
  removeFromList(targets.get(id))
  targets.delete(id)
}

export function getCollisionTargets(): readonly CollisionTarget[] {
  return targetList
}

/**
 * Resolve one hit on a target: count it for accuracy, emit `enemy:hit`, then run its own
 * hit handler. The bullet pool's collision pass and the e2e hook both take this path.
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
    targetList.length = 0
  })
}
