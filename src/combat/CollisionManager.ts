import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { useGameStore } from '@/store/useGameStore'

export interface CollisionTarget {
  id: string
  getPosition: () => THREE.Vector3
  radiusSq: number
  onHit: () => void
  /**
   * A weapon pickup (#185) or a junction's switch (#702) is shot like an enemy but is none: no `enemy:hit`. A bystander
   * (#518) is no target at all: no `enemy:hit`, and its bullet counts as a miss for accuracy.
   */
  kind?: 'pickup' | 'switch' | 'bystander'
  hitThisFrame: boolean
  /** The hitting bullet's first target that counts (`countsForAccuracy`): only that hit counts for accuracy. */
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

/**
 * Every registered target, walked by index every frame (the bullets' hit test, aim assist): a `for…of` over
 * a Map allocates an iterator per walk, and the hit test walked it once per live bullet (#596). Registering
 * and unregistering are cold paths, so they search it.
 */
const targetList: CollisionTarget[] = []
const hitEvent: EnemyHitEvent = { id: '', position: new THREE.Vector3() }

function removeTarget(id: string): void {
  const i = targetList.findIndex((t) => t.id === id)
  if (i >= 0) targetList.splice(i, 1)
}

export function registerCollisionTarget(target: Omit<CollisionTarget, 'hitThisFrame' | 'firstHitThisFrame'>): void {
  removeTarget(target.id)
  targetList.push({ ...target, hitThisFrame: false, firstHitThisFrame: false })
}

export function unregisterCollisionTarget(id: string): void {
  removeTarget(id)
}

export function getCollisionTargets(): readonly CollisionTarget[] {
  return targetList
}

/** A bystander hit is no hit for accuracy (#518), so a bullet piercing one still scores the target behind it (#629). */
export function countsForAccuracy(target: CollisionTarget): boolean {
  return target.kind !== 'bystander'
}

/**
 * Resolve one hit on a target: count it for accuracy, emit `enemy:hit`, then run its own
 * hit handler. The bullet pool's collision pass and the e2e hook both take this path.
 */
export function processHit(target: CollisionTarget, countHit = true): void {
  if (target.kind === 'bystander') {
    target.onHit()
    return
  }
  if (countHit) useGameStore.getState().registerHit()
  if (target.kind === 'pickup' || target.kind === 'switch') {
    target.onHit()
    return
  }
  hitEvent.id = target.id
  hitEvent.position.copy(target.getPosition())
  eventBus.emit('enemy:hit', hitEvent)
  target.onHit()
}

/**
 * Process every target flagged `hitThisFrame` this frame. A hit handler can unregister targets (a kill, a
 * pickup, a boss part retracting) or register new ones mid-walk, so the walk runs backwards: a removal at or
 * before the current index never shifts an unvisited target past it, and targets pushed on the end are new
 * and unflagged.
 */
export function processFlaggedHits(): void {
  for (let t = targetList.length - 1; t >= 0; t--) {
    const target = targetList[t]
    if (target === undefined || !target.hitThisFrame) continue
    target.hitThisFrame = false
    processHit(target, target.firstHitThisFrame)
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    targetList.length = 0
  })
}
