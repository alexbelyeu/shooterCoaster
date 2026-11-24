import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
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

  it("counts a hit toward FRENZY by when its bullet was fired, not when it lands (#904)", () => {
    const store = useGameStore.getState
    store().startRun('level1')
    registerCollisionTarget(target('t'))
    const t = getCollisionTargets()[0]
    const land = (firedInFrenzy: boolean) => {
      t.hitThisFrame = true
      t.firstHitThisFrame = true
      t.hitInFrenzy = firedInFrenzy
      processFlaggedHits()
    }
    // A flawless FRENZY: the last shot is still in the air when FRENZY ends, and lands after.
    store().setSlowMo(0.35, 'on')
    store().registerShot()
    land(true)
    store().registerShot()
    store().setSlowMo(1, 'off')
    land(true)
    // A shot fired just before the next FRENZY lands inside it: no unpaired FRENZY hit.
    store().registerShot()
    store().setSlowMo(0.35, 'on')
    land(false)
    expect(store()).toMatchObject({ shotsFired: 3, hits: 3, frenzyShots: 2, frenzyHits: 2 })
    unregisterCollisionTarget('t')
  })
})
