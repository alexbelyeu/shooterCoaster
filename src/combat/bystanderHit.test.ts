import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { eventBus } from '@/core/EventBus'
import { BYSTANDER_PENALTY } from '@/levels/scoring'
import { BYSTANDER_HIT_EVENT } from './bystanders'
import { hitBystander } from './bystanderHit'
import { processHit, registerCollisionTarget, getCollisionTargets, unregisterCollisionTarget } from './CollisionManager'
import { resetComboRuntime } from './comboRuntime'

// zustand's persist wants window.localStorage; a bare in-memory one is enough here.
vi.hoisted(() => {
  const data = new Map<string, string>()
  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
  }
})

const initial = useGameStore.getState()
const store = () => useGameStore.getState()
const at = new THREE.Vector3(10, 20, 30)
const broken = vi.fn()
const hit = vi.fn()
const enemyHit = vi.fn()

beforeEach(() => {
  useGameStore.setState(initial, true)
  resetComboRuntime()
  eventBus.on('combo:broken', broken)
  eventBus.on(BYSTANDER_HIT_EVENT, hit)
  eventBus.on('enemy:hit', enemyHit)
})
afterEach(() => {
  eventBus.off('combo:broken', broken)
  eventBus.off(BYSTANDER_HIT_EVENT, hit)
  eventBus.off('enemy:hit', enemyHit)
  broken.mockReset()
  hit.mockReset()
  enemyHit.mockReset()
  unregisterCollisionTarget('bystander-1')
})

describe('hitting a bystander', () => {
  it('costs the penalty once per bystander', () => {
    useGameStore.setState({ score: 100 })
    hitBystander('bystander-1', 'climber', at)
    hitBystander('bystander-1', 'climber', at)
    expect(store().score).toBe(100 - BYSTANDER_PENALTY)
    hitBystander('bystander-2', 'climber', at)
    expect(store().score).toBe(100 - 2 * BYSTANDER_PENALTY)
    expect(store().bystandersHit).toEqual(['bystander-1', 'bystander-2'])
    expect(hit).toHaveBeenCalledTimes(2)
    expect(hit.mock.calls[0][0]).toMatchObject({ type: 'climber', penalty: BYSTANDER_PENALTY, position: { x: 10, y: 20, z: 30 } })
  })

  it('never takes the score below 0', () => {
    useGameStore.setState({ score: BYSTANDER_PENALTY / 2 })
    hitBystander('bystander-1', 'climber', at)
    expect(store().score).toBe(0)
  })

  it('breaks the combo, through combo:broken', () => {
    for (let i = 0; i < 5; i++) store().registerKill()
    expect(store().combo.multiplier).toBeGreaterThan(1)
    hitBystander('bystander-1', 'climber', at)
    expect(store().combo.count).toBe(0)
    expect(broken).toHaveBeenCalledOnce()
    expect(broken.mock.calls[0][0]).toMatchObject({ count: 5, tier: 1 })
  })

  it('is no kill and, through processHit, no hit for accuracy and no enemy:hit', () => {
    registerCollisionTarget({
      id: 'bystander-1',
      kind: 'bystander',
      getPosition: () => at,
      radiusSq: 2500,
      onHit: () => hitBystander('bystander-1', 'climber', at),
    })
    processHit(getCollisionTargets().get('bystander-1')!)
    expect(store()).toMatchObject({ kills: 0, hits: 0, bystandersHit: ['bystander-1'] })
    expect(enemyHit).not.toHaveBeenCalled()
  })

  it('a new run forgets who was hit', () => {
    hitBystander('bystander-1', 'climber', at)
    store().startRun('level6', 1)
    expect(store().bystandersHit).toEqual([])
  })
})
