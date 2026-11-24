import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { eventBus } from '@/core/EventBus'
import { ENEMY_HIT_FLASH_MS, KILL_POP_SCALE, type EnemyKilledEvent } from '@/combat/hitFeedback'
import { setExplosionPool } from '@/effects/explosionPoolHandle'
import { BOSS_PART_DEATH_STYLE, DEATH_STYLES } from '@/effects/deathStyles'
import { createKillPop, finishKillPop, startKillPop, tickKillPop } from './killPop'

const initial = useGameStore.getState()
const killed = vi.fn()
const explode = vi.fn()

beforeEach(() => {
  useGameStore.setState(initial, true)
  eventBus.on('enemy:killed', killed)
  setExplosionPool({ explode })
})
afterEach(() => {
  eventBus.off('enemy:killed', killed)
  setExplosionPool(null)
  killed.mockReset()
  explode.mockReset()
})

describe('kill pop', () => {
  it('scores on the hit and pops the target', () => {
    const pop = createKillPop()
    const target = new THREE.Group()
    startKillPop(pop, target, 150)
    const s = useGameStore.getState()
    expect(s.kills).toBe(1)
    expect(s.score).toBe(150)
    expect(pop.active).toBe(true)
    expect(target.scale.x).toBe(KILL_POP_SCALE)
    expect(killed).not.toHaveBeenCalled()
  })

  it('lasts ENEMY_HIT_FLASH_MS of game time and at least two ticks', () => {
    const pop = createKillPop()
    startKillPop(pop, null, 10)
    // One huge frame (the hit landed earlier in it): still drawn once more.
    expect(tickKillPop(pop, 1)).toBe(false)
    expect(tickKillPop(pop, 0)).toBe(true)

    startKillPop(pop, null, 10)
    const step = ENEMY_HIT_FLASH_MS / 1000 / 4
    const ticks = [1, 2, 3, 4].map(() => tickKillPop(pop, step))
    expect(ticks).toEqual([false, false, false, true])
    expect(tickKillPop(createKillPop(), 1)).toBe(false)
  })

  it('ends in one enemy:killed with the combo multiplier, then the style burst', () => {
    const pop = createKillPop()
    const target = new THREE.Group()
    startKillPop(pop, target, 100)
    startKillPop(createKillPop(), null, 100) // a second kill raises the multiplier
    const at = new THREE.Vector3(1, 2, 3)
    finishKillPop(pop, target, at, DEATH_STYLES.crow)
    const { combo } = useGameStore.getState()
    const event = killed.mock.calls[0][0] as EnemyKilledEvent
    expect(event).toEqual({ position: at, combo: combo.count, multiplier: combo.multiplier, score: Math.round(100 * combo.multiplier), sound: 'flutter' })
    expect(explode).toHaveBeenCalledWith(at, DEATH_STYLES.crow)
    expect(target.scale.x).toBe(1)
    expect(pop.active).toBe(false)
  })

  it('carries a boss part and the big popup only when asked', () => {
    const pop = createKillPop()
    startKillPop(pop, null, 400)
    finishKillPop(pop, null, new THREE.Vector3(), BOSS_PART_DEATH_STYLE, { bossPart: 'gondola', big: true })
    expect(killed.mock.calls[0][0]).toMatchObject({ bossPart: 'gondola', big: true })
    startKillPop(pop, null, 400)
    finishKillPop(pop, null, new THREE.Vector3(), DEATH_STYLES.balloon)
    expect(killed.mock.calls[1][0]).not.toHaveProperty('big')
  })
})
