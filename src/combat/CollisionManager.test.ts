import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { getCollisionTargets, registerCollisionTarget, unregisterCollisionTarget } from './CollisionManager'

const target = (id: string, radiusSq = 1) => ({ id, getPosition: () => new THREE.Vector3(), radiusSq, onHit: () => {} })

describe('collision targets', () => {
  it('keeps the walked list in step with registering, re-registering and unregistering', () => {
    registerCollisionTarget(target('a'))
    registerCollisionTarget(target('b'))
    registerCollisionTarget(target('a', 4))
    expect(getCollisionTargets().map((t) => [t.id, t.radiusSq])).toEqual([
      ['b', 1],
      ['a', 4],
    ])
    unregisterCollisionTarget('b')
    unregisterCollisionTarget('missing')
    expect(getCollisionTargets().map((t) => t.id)).toEqual(['a'])
    unregisterCollisionTarget('a')
    expect(getCollisionTargets()).toHaveLength(0)
  })
})
