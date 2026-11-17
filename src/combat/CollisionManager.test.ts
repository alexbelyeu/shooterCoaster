import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  getCollisionTargets,
  processFlaggedHits,
  registerCollisionTarget,
  unregisterCollisionTarget,
} from './CollisionManager'

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

  it('processes every flagged target when a hit handler unregisters others mid-walk (#621)', () => {
    const hits: string[] = []
    const flag = (id: string) => {
      const t = getCollisionTargets().find((c) => c.id === id)!
      t.hitThisFrame = true
    }
    // Each kill unregisters itself (EnemyBase.kill), and `b` also takes `a` with it (a boss part retracting).
    const dying = (id: string, alsoRemove?: string) => ({
      ...target(id),
      onHit: () => {
        hits.push(id)
        unregisterCollisionTarget(id)
        if (alsoRemove) unregisterCollisionTarget(alsoRemove)
        registerCollisionTarget(target(`${id}-spawned`))
      },
    })
    for (const id of ['a', 'c', 'd']) registerCollisionTarget(dying(id))
    registerCollisionTarget(dying('b', 'a'))
    for (const id of ['c', 'd', 'b']) flag(id)
    processFlaggedHits()
    expect(hits.sort()).toEqual(['b', 'c', 'd'])
    expect(getCollisionTargets().every((t) => !t.hitThisFrame)).toBe(true)
    for (const t of [...getCollisionTargets()]) unregisterCollisionTarget(t.id)
  })
})
