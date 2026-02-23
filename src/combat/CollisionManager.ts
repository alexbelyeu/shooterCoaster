import * as THREE from 'three'

export interface CollisionTarget {
  id: string
  getPosition: () => THREE.Vector3
  radiusSq: number
  onHit: () => void
  hitThisFrame: boolean
}

const targets = new Map<string, CollisionTarget>()

export function registerCollisionTarget(target: Omit<CollisionTarget, 'hitThisFrame'>): void {
  targets.set(target.id, { ...target, hitThisFrame: false })
}

export function unregisterCollisionTarget(id: string): void {
  targets.delete(id)
}

export function getCollisionTargets(): Map<string, CollisionTarget> {
  return targets
}
