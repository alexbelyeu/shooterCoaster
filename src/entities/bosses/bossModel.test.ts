import { describe, expect, it } from 'vitest'
import {
  applyHit, bossMaxScore, createBossState, currentPhase, destroyScore, exposedWeakPoints, hpFraction,
  isDefeated, isExposed, maxHp, weakPointHp, type BossSpec, type BossState,
} from './bossModel'
import { BOSS_SPECS, GOLDEN_BLIMP } from './bossSpecs'

const spec: BossSpec = {
  name: 'Test',
  tell: { seconds: 1, label: 'Test!' },
  reward: 100,
  weakPoints: [
    { id: 'a', radius: 10, offset: [0, 0, 0], hp: 2, score: 10, phase: 0 },
    { id: 'b', radius: 10, offset: [0, 0, 0], hp: 1, score: 10, phase: 0 },
    { id: 'core', radius: 10, offset: [0, 0, 0], hp: 3, score: 0, phase: 1 },
  ],
}

const ids = (s: BossState) => exposedWeakPoints(s).map((w) => w.id)
const hitAll = (s: BossState, id: string, n: number) => {
  for (let i = 0; i < n; i++) s = applyHit(s, id)
  return s
}

describe('bossModel', () => {
  it('starts with phase 0 exposed and full hp', () => {
    const s = createBossState(spec)
    expect(ids(s)).toEqual(['a', 'b'])
    expect(currentPhase(s)).toBe(0)
    expect(hpFraction(s)).toBe(1)
    expect(maxHp(spec)).toBe(6)
    expect(isDefeated(s)).toBe(false)
  })

  it('a later phase ignores hits until the earlier one is destroyed', () => {
    const s = createBossState(spec)
    expect(isExposed(s, 'core')).toBe(false)
    expect(applyHit(s, 'core')).toBe(s)
    expect(applyHit(s, 'nope')).toBe(s)
  })

  it('takes hits in order: a weak point loses hp, is destroyed at 0, then ignores hits', () => {
    let s = createBossState(spec)
    s = applyHit(s, 'a')
    expect(weakPointHp(s, 'a')).toBe(1)
    expect(ids(s)).toEqual(['a', 'b'])
    s = applyHit(s, 'a')
    expect(weakPointHp(s, 'a')).toBe(0)
    expect(ids(s)).toEqual(['b'])
    expect(applyHit(s, 'a')).toBe(s)
  })

  it('moves to the next phase once every weak point of the current one is destroyed', () => {
    let s = hitAll(createBossState(spec), 'a', 2)
    s = applyHit(s, 'b')
    expect(currentPhase(s)).toBe(1)
    expect(ids(s)).toEqual(['core'])
    expect(hpFraction(s)).toBeCloseTo(3 / 6)
  })

  it('is defeated when the last weak point falls, and stays put after', () => {
    let s = hitAll(createBossState(spec), 'a', 2)
    s = applyHit(s, 'b')
    s = hitAll(s, 'core', 2)
    expect(isDefeated(s)).toBe(false)
    expect(hpFraction(s)).toBeCloseTo(1 / 6)
    s = applyHit(s, 'core')
    expect(isDefeated(s)).toBe(true)
    expect(currentPhase(s)).toBe(-1)
    expect(ids(s)).toEqual([])
    expect(hpFraction(s)).toBe(0)
    expect(applyHit(s, 'core')).toBe(s)
  })

  it('scores a weak point when destroyed, and the reward with the last one', () => {
    let s = createBossState(spec)
    let next = applyHit(s, 'a')
    expect(destroyScore(s, next, 'a')).toBe(0)
    s = next
    next = applyHit(s, 'a')
    expect(destroyScore(s, next, 'a')).toBe(10)
    s = applyHit(next, 'b')
    s = hitAll(s, 'core', 2)
    next = applyHit(s, 'core')
    expect(destroyScore(s, next, 'core')).toBe(100)
    expect(bossMaxScore(spec)).toBe(120)
  })
})

describe('bossSpecs', () => {
  it.each(Object.entries(BOSS_SPECS))('%s: unique weak points with positive hp and radius, phase 0 first', (_type, boss) => {
    const wps = boss.weakPoints
    expect(new Set(wps.map((w) => w.id)).size).toBe(wps.length)
    for (const w of wps) {
      expect(w.hp).toBeGreaterThan(0)
      expect(w.radius).toBeGreaterThan(0)
      expect(w.score).toBeGreaterThanOrEqual(0)
    }
    expect(Math.min(...wps.map((w) => w.phase))).toBe(0)
    expect(boss.reward).toBeGreaterThan(0)
    expect(boss.tell.seconds).toBeGreaterThan(0)
  })

  it('the Golden Blimp: 5 golden balloons, then a 3-hit gondola', () => {
    const s = createBossState(GOLDEN_BLIMP)
    expect(ids(s)).toEqual(['balloon-0', 'balloon-1', 'balloon-2', 'balloon-3', 'balloon-4'])
    let t = s
    for (const w of exposedWeakPoints(s)) t = hitAll(t, w.id, w.hp)
    expect(ids(t)).toEqual(['gondola'])
    expect(weakPointHp(t, 'gondola')).toBe(3)
    expect(isDefeated(hitAll(t, 'gondola', 3))).toBe(true)
  })
})
