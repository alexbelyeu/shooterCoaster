import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { buildArcTable } from '@/track/arcLength'
import { createTrigCurve } from '@/track/curves/TrigCurve'
import { createHeightFunction, createTerrainSurface, getTerrainMeshSize, sampleTrackPath } from '@/utils/terrainNoise'
import { buildTrackIndex } from '@/levels/environments/shared/trackClearance'
import { desertObstacles, layoutDesert } from '@/levels/environments/biomes/desert/desertLayout'
import { indexAhead, trackTangent } from '@/entities/spawning/spawnPlacement'
import { BOSS_SPECS, GIANT_SCORPION } from './bossSpecs'
import { applyHit, bossMaxScore, createBossState, exposedWeakPoints, isDefeated, type BossState } from './bossModel'
import {
  LUNGE_IMPACT_S, PERCH, SCORPION_LUNGE, SCORPION_RISE, SCORPION_TAIL, approachAngle, createTailPose, faceYaw, footStep, layTail,
  lungeAmount, lungeImpactBetween, perchClear, pickPerch, riseOffset, tailTopY, type Perch, type PerchInput,
} from './scorpionMotion'

const hitAll = (state: BossState, ids: string[]) =>
  ids.reduce((s, id) => {
    let next = s
    for (let i = 0; i < 5; i++) next = applyHit(next, id)
    return next
  }, state)

describe('Giant Scorpion spec', () => {
  const ids = () => exposedWeakPoints(createBossState(GIANT_SCORPION)).map((w) => w.id)

  it('opens with both claws and the four tail segments; the stinger waits', () => {
    expect(ids()).toEqual(['claw-l', 'claw-r', 'tail-0', 'tail-1', 'tail-2', 'tail-3'])
    expect(BOSS_SPECS.giantScorpion).toBe(GIANT_SCORPION)
  })

  it('the stinger is a target only once the tail is bare and the claws are broken', () => {
    let s = createBossState(GIANT_SCORPION)
    s = hitAll(s, ['claw-l', 'claw-r', 'tail-0', 'tail-1', 'tail-2'])
    expect(exposedWeakPoints(s).map((w) => w.id)).toEqual(['tail-3'])
    expect(applyHit(s, 'stinger')).toBe(s)
    s = hitAll(s, ['tail-3'])
    expect(exposedWeakPoints(s).map((w) => w.id)).toEqual(['stinger'])
    s = hitAll(s, ['stinger'])
    expect(isDefeated(s)).toBe(true)
  })

  it('claws take 2 hits for 60, tail segments 1 for 40, the stinger 3 for the 400 reward', () => {
    const wp = (id: string) => GIANT_SCORPION.weakPoints.find((w) => w.id === id)!
    expect([wp('claw-l').hp, wp('claw-l').score]).toEqual([2, 60])
    expect([wp('tail-2').hp, wp('tail-2').score]).toEqual([1, 40])
    expect([wp('stinger').hp, wp('stinger').score]).toEqual([3, 0])
    expect(bossMaxScore(GIANT_SCORPION)).toBe(2 * 60 + 4 * 40 + 400)
  })
})

describe('tail', () => {
  it('stands taller than the ride is high on average, the stinger hooked over', () => {
    const pose = layTail(createTailPose(), SCORPION_TAIL.segments, 0, 0)
    expect(tailTopY(pose)).toBeGreaterThan(450)
    expect(pose.theta[SCORPION_TAIL.segments]).toBeGreaterThan(pose.theta[SCORPION_TAIL.segments - 1])
  })

  it('gets shorter as segments break, down to the stinger on the bare stub', () => {
    const tops = [4, 3, 2, 1, 0].map((live) => tailTopY(layTail(createTailPose(), live, 0, 0)))
    for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeLessThan(tops[i - 1])
    const bare = layTail(createTailPose(), 0, 0, 0)
    expect(bare.count).toBe(0)
    expect(tailTopY(bare)).toBe(bare.y[0])
  })

  it('lunges forward over the body at the strike and winds back before it', () => {
    const rest = layTail(createTailPose(), 4, 0, 0)
    const restTip = rest.z[4]
    const strike = layTail(createTailPose(), 4, 1, 0)
    expect(strike.z[4]).toBeGreaterThan(restTip + 100)
    const windup = layTail(createTailPose(), 4, SCORPION_TAIL.windup, 0)
    expect(windup.z[4]).toBeLessThan(restTip)
  })
})

describe('lunge', () => {
  const L = SCORPION_LUNGE

  it('waits, winds up, strikes to 1, holds and recovers', () => {
    expect(lungeAmount(L.first - 0.1)).toBe(0)
    expect(lungeAmount(L.first + L.windupS)).toBeCloseTo(SCORPION_TAIL.windup)
    expect(lungeAmount(L.first + LUNGE_IMPACT_S + 0.01)).toBe(1)
    expect(lungeAmount(L.first + LUNGE_IMPACT_S + L.holdS + L.recoverS + 0.01)).toBeCloseTo(0)
  })

  it('lands one strike per period, at the impact moment', () => {
    let strikes = 0
    let prev = 0
    for (let t = 1 / 60; t <= L.first + L.period * 3; t += 1 / 60) {
      if (lungeImpactBetween(prev, t)) {
        strikes++
        expect(lungeAmount(t)).toBeGreaterThan(0.9)
      }
      prev = t
    }
    expect(strikes).toBe(3)
    expect(lungeImpactBetween(5, 5)).toBe(false)
  })
})

describe('rise and collapse', () => {
  it('starts under the sand, bursts out past the surface and settles on it', () => {
    expect(riseOffset(0, -1)).toBeCloseTo(-SCORPION_RISE.depth)
    let peak = -Infinity
    for (let t = 0; t <= SCORPION_RISE.riseS; t += 0.01) peak = Math.max(peak, riseOffset(t, -1))
    expect(peak).toBeGreaterThan(0)
    expect(riseOffset(SCORPION_RISE.riseS + 1, -1)).toBeCloseTo(0)
  })

  it('collapses fully under the sand over sinkS once defeated', () => {
    const up = SCORPION_RISE.riseS + 5
    expect(riseOffset(up, 0)).toBeCloseTo(0)
    expect(riseOffset(up + SCORPION_RISE.sinkS, SCORPION_RISE.sinkS)).toBeCloseTo(-SCORPION_RISE.depth)
  })
})

describe('gait and facing', () => {
  it('alternates: neighbouring legs and opposite legs are half a cycle apart; stance feet stay down', () => {
    const a = footStep({ dz: 0, lift: 0 }, 1, 0, 1)
    const b = footStep({ dz: 0, lift: 0 }, 1, 1, 1)
    const c = footStep({ dz: 0, lift: 0 }, 1, 0, -1)
    expect(a.dz).toBeCloseTo(-b.dz)
    expect(a.dz).toBeCloseTo(-c.dz)
    expect(a.lift > 0).not.toBe(b.lift > 0)
    expect(Math.min(a.lift, b.lift)).toBe(0)
  })

  it('turns part of the way from the rider to its heading, the short way round', () => {
    expect(faceYaw(0, 1, 0.35)).toBeCloseTo(0.35)
    expect(faceYaw(3, -3, 0.5)).toBeCloseTo(3 + (2 * Math.PI - 6) / 2)
    expect(approachAngle(3, -3, 1)).toBeCloseTo(3 + 2 * Math.PI - 6)
  })
})

describe('perch (level 2)', () => {
  const { varA, varB, varC, scalar } = getLevelConfig('level2')!.track
  const curve = createTrigCurve(varA, varB, varC, scalar)
  const table = buildArcTable(curve)
  const groundFn = createTerrainSurface(
    createHeightFunction('desert', sampleTrackPath((t) => curve.getPointAt(t))),
    getTerrainMeshSize('desert'),
  )
  const index = buildTrackIndex(table)
  const avoid = desertObstacles(layoutDesert(groundFn, table).mesas)
  const riders = Array.from({ length: 80 }, (_, i) => indexAhead(table, 0, (i / 80) * table.length))
  const view = (at: number): PerchInput => {
    const t = trackTangent(table, at)
    const h = Math.hypot(t.x, t.z) || 1
    return { index, avoid, camera: { x: table.x[at], z: table.z[at] }, forwardX: t.x / h, forwardZ: t.z / h }
  }

  it('finds a spot ahead of the rider, clear of the rails, towers, landmarks and mesas, almost everywhere on the ride', () => {
    let found = 0
    for (const at of riders) {
      const input = view(at)
      const perch: Perch = { x: 0, z: 0, slot: 0, sign: 1 }
      if (!pickPerch(perch, input)) continue
      found++
      expect(perchClear(input, perch.x, perch.z)).toBe(true)
      expect(index.near(perch.x, perch.z, PERCH.footprint)).toBe(false)
      for (const a of avoid) expect(Math.hypot(a.x - perch.x, a.z - perch.z)).toBeGreaterThan(a.r)
      const dx = perch.x - input.camera.x
      const dz = perch.z - input.camera.z
      expect(dx * input.forwardX + dz * input.forwardZ).toBeGreaterThan(500)
    }
    expect(found / riders.length).toBeGreaterThan(0.9)
  })

  it('keeps its slot and side while they stay clear', () => {
    let kept = 0
    let tries = 0
    for (const at of riders) {
      const perch: Perch = { x: 0, z: 0, slot: 0, sign: 1 }
      if (!pickPerch(perch, view(at))) continue
      const again = { ...perch }
      const next = view(indexAhead(table, at, 20))
      const before = { slot: again.slot, sign: again.sign }
      if (!pickPerch(again, next)) continue
      tries++
      if (again.slot === before.slot && again.sign === before.sign) kept++
    }
    expect(kept / tries).toBeGreaterThan(0.8)
  })

  it('leaves the perch untouched when nothing is clear', () => {
    const blocked: PerchInput = { ...view(riders[0]), index: { table, near: () => true } }
    const perch: Perch = { x: 1, z: 2, slot: 3, sign: -1 }
    expect(pickPerch(perch, blocked)).toBe(false)
    expect(perch).toEqual({ x: 1, z: 2, slot: 3, sign: -1 })
  })
})
