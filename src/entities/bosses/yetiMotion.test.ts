import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { scoreLimits } from '@/levels/scoreLimits'
import {
  applyHit, bossMaxScore, createBossState, currentPhase, exposedWeakPoints, hpFraction, isDefeated, setRetracted, type BossState,
} from './bossModel'
import { YETI, YETI_SNOWBALL } from './bossSpecs'
import {
  THROW_S, YETI_ROAM, YETI_ROAR, YETI_THROW, chestRetracted, elbowPose, fistPose, isRoaring, lopeAt, needsRelocate, passedCamera,
  riseOffset, roarAmount, roarNowEpoch, snowballAt, throwArmAlive, throwSwing, timeToNextRoar, toppleAngle, type Point3,
} from './yetiMotion'

const ids = (s: BossState) => exposedWeakPoints(s).map((w) => w.id)
const hit = (s: BossState, id: string, n: number) => {
  for (let i = 0; i < n; i++) s = applyHit(s, id)
  return s
}
const atRoarTime = (s: BossState, roarT: number) => setRetracted(s, 'chest', chestRetracted(currentPhase(s) === 1, roarT))

describe('the Yeti spec', () => {
  it('both fists first, in either order; then the chest', () => {
    const start = createBossState(YETI)
    expect(ids(start)).toEqual(['fist-l', 'fist-r'])
    for (const order of [['fist-l', 'fist-r'], ['fist-r', 'fist-l']]) {
      let s = hit(start, order[0], 2)
      expect(ids(s)).toEqual([order[1]])
      s = hit(s, order[1], 2)
      expect(ids(s)).toEqual(['chest'])
      expect(isDefeated(hit(s, 'chest', 4))).toBe(true)
    }
  })

  it('the chest is exposed only while it roars, and a hit between roars does nothing', () => {
    let s = hit(hit(createBossState(YETI), 'fist-l', 2), 'fist-r', 2)
    const epoch = roarNowEpoch(10)
    for (let t = 10; t < 10 + 2 * YETI_ROAR.period; t += 0.1) {
      s = atRoarTime(s, t - epoch)
      expect(ids(s).includes('chest')).toBe(isRoaring(t - epoch))
    }
    s = atRoarTime(s, YETI_ROAR.first + YETI_ROAR.roarS + 0.5)
    expect(applyHit(s, 'chest')).toBe(s)
  })

  it('in the first phase the roar never exposes the chest early', () => {
    const s = atRoarTime(createBossState(YETI), YETI_ROAR.first + 0.5)
    expect(isRoaring(YETI_ROAR.first + 0.5)).toBe(true)
    expect(ids(s)).toEqual(['fist-l', 'fist-r'])
  })

  it('scores 520; its snowballs are bonus kills the server allows, more than a 20 s fight can throw', () => {
    expect(bossMaxScore(YETI)).toBe(2 * 60 + 400)
    const level = getLevelConfig('level4')!
    expect(level.boss?.type).toBe('yeti')
    const limits = scoreLimits(level)
    const withoutSnowballs = scoreLimits({ ...level, boss: undefined })
    expect(limits.maxKills - withoutSnowballs.maxKills).toBe(YETI.weakPoints.length + YETI_SNOWBALL.max)
    expect(20 / (THROW_S + YETI_THROW.gapS)).toBeLessThan(YETI_SNOWBALL.max)
  })

  it('a hit on a fist moves hp; nothing else does', () => {
    const s = createBossState(YETI)
    expect(hpFraction(applyHit(s, 'fist-l'))).toBeLessThan(1)
    expect(applyHit(s, 'chest')).toBe(s)
  })
})

describe('yetiMotion', () => {
  it('roars on a fixed cycle, the first as it arrives, and a roar can start at once', () => {
    expect(isRoaring(0)).toBe(false)
    expect(isRoaring(YETI_ROAR.first + 0.1)).toBe(true)
    expect(isRoaring(YETI_ROAR.first + YETI_ROAR.roarS + 0.1)).toBe(false)
    expect(isRoaring(YETI_ROAR.first + YETI_ROAR.period + 0.1)).toBe(true)
    expect(roarAmount(YETI_ROAR.first + YETI_ROAR.roarS / 2)).toBe(1)
    expect(roarAmount(YETI_ROAR.first + YETI_ROAR.roarS + 0.1)).toBe(0)
    expect(timeToNextRoar(0)).toBeCloseTo(YETI_ROAR.first)
    expect(timeToNextRoar(YETI_ROAR.first + 1)).toBe(0)
    expect(timeToNextRoar(YETI_ROAR.first + YETI_ROAR.roarS)).toBeCloseTo(YETI_ROAR.period - YETI_ROAR.roarS)
    expect(isRoaring(42 - roarNowEpoch(42))).toBe(true)
  })

  it('leaves room between roars for a throw and a lope', () => {
    expect(YETI_ROAR.period - YETI_ROAR.roarS).toBeGreaterThan(THROW_S + YETI_ROAM.lopeS)
  })

  it('throws with the preferred arm, the other when that fist is gone, none with no fists', () => {
    expect(throwArmAlive(0, true, true)).toBe(0)
    expect(throwArmAlive(1, true, true)).toBe(1)
    expect(throwArmAlive(0, false, true)).toBe(1)
    expect(throwArmAlive(1, true, false)).toBe(0)
    expect(throwArmAlive(0, false, false)).toBe(-1)
  })

  it('a throw winds up behind the head, snaps forward at release and comes back to rest', () => {
    expect(throwSwing(0)).toBe(0)
    expect(throwSwing(YETI_THROW.windupS - 0.01)).toBe(-1)
    expect(throwSwing(YETI_THROW.windupS + YETI_THROW.followS * 0.25)).toBeCloseTo(1)
    expect(throwSwing(THROW_S)).toBe(0)
    const rest = fistPose({ x: 0, y: 0, z: 0 }, 1, 0, 0, 0)
    const back = fistPose({ x: 0, y: 0, z: 0 }, 1, 0, -1, 0)
    const up = fistPose({ x: 0, y: 0, z: 0 }, -1, 1, 0, 0)
    expect(back.y).toBeGreaterThan(rest.y)
    expect(back.z).toBeLessThan(rest.z)
    expect(up.y).toBeGreaterThan(rest.y)
    expect(up.x).toBeLessThan(0)
    const elbow = elbowPose({ x: 0, y: 0, z: 0 }, 1, rest)
    expect(elbow.x).toBeGreaterThan(0)
  })

  it('climbs up from below the ridge and topples backwards', () => {
    expect(riseOffset(0)).toBeLessThan(-500)
    expect(riseOffset(10)).toBeCloseTo(0)
    expect(toppleAngle(-1)).toBe(0)
    expect(toppleAngle(10)).toBeLessThan(-1.2)
  })

  it('moves on when the rider nears its ridge, it slips off the view or has held it long', () => {
    expect(needsRelocate(1, 1200, 400)).toBe(false)
    expect(needsRelocate(YETI_ROAM.holdS, 1200, 400)).toBe(true)
    expect(needsRelocate(1, YETI_ROAM.minAhead - 1, 0)).toBe(true)
    expect(needsRelocate(1, 600, 1200)).toBe(true)
    const lope = { t: 0, lift: 0 }
    expect(lopeAt(lope, 0).t).toBe(0)
    expect(lopeAt(lope, YETI_ROAM.lopeS).t).toBe(1)
    expect(lopeAt(lope, YETI_ROAM.lopeS / (2 * YETI_ROAM.hops)).lift).toBeCloseTo(YETI_ROAM.hopHeight)
  })

  it('a snowball arcs from the fist to the point beside the camera and reports passing it once', () => {
    const from: Point3 = { x: 0, y: 600, z: 0 }
    const to: Point3 = { x: 1000, y: 0, z: 0 }
    const out = { x: 0, y: 0, z: 0 }
    expect(snowballAt(out, from, to, 0)).toEqual(from)
    expect(snowballAt(out, from, to, 1)).toEqual(to)
    expect(snowballAt(out, from, to, 0.5).y).toBeGreaterThan(300 + YETI_THROW.arc - 1)
    let passes = 0
    let prev = 0
    for (let s = 0; s < 1.2; s += 0.07) {
      if (passedCamera(prev, s)) passes++
      prev = s
    }
    expect(passes).toBe(1)
  })
})
