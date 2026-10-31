import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { buildArcTable } from '@/track/arcLength'
import { createTrigCurve } from '@/track/curves/TrigCurve'
import { createHeightFunction, createTerrainSurface, getTerrainMeshSize, sampleTrackPath } from '@/utils/terrainNoise'
import { createRng } from '@/utils/rng'
import { buildTrackIndex } from '@/levels/environments/shared/trackClearance'
import { oceanLayout, seaObstacles } from '@/levels/environments/biomes/ocean/seaPlacement'
import { indexAhead, trackTangent } from '@/entities/spawning/spawnPlacement'
import { KRAKEN, BOSS_SPECS } from './bossSpecs'
import { createBossState, applyHit, exposedWeakPoints } from './bossModel'
import {
  KRAKEN_HEAD, KRAKEN_TENTACLE, SLAM_IMPACT_S, SPOTS, createChain, headFrame, layChain, pickSpot, slamBend, slamImpactBetween,
  tentacleFrame, type Spot,
} from './krakenMotion'

const T = KRAKEN_TENTACLE
const LENGTH = T.segments * T.segLen
const frame = () => ({ emerge: 0, bend: 0, yaw: 0 })

describe('tentacle cycle', () => {
  const sinkAt = T.riseS + T.upS

  it('is under water before it starts, out after the rise, and under again once it has sunk', () => {
    expect(tentacleFrame(frame(), -0.5, sinkAt, 0).emerge).toBe(0)
    expect(tentacleFrame(frame(), 0, sinkAt, 0).emerge).toBeCloseTo(0)
    expect(tentacleFrame(frame(), T.riseS, sinkAt, 0).emerge).toBeCloseTo(1)
    expect(tentacleFrame(frame(), sinkAt - 0.1, sinkAt, 0).emerge).toBeCloseTo(1)
    expect(tentacleFrame(frame(), sinkAt + T.sinkS, sinkAt, 0).emerge).toBeCloseTo(0)
  })

  it('erupts: overshoots the surface a little during the rise', () => {
    let peak = 0
    for (let t = 0; t <= T.riseS; t += 0.01) peak = Math.max(peak, tentacleFrame(frame(), t, sinkAt, 0).emerge)
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThan(1.3)
  })

  it('winds back, then slams over onto the water and recovers', () => {
    expect(slamBend(T.windupS * 0.99)).toBeLessThan(-0.4)
    expect(slamBend(SLAM_IMPACT_S)).toBeCloseTo(T.slam)
    expect(slamBend(SLAM_IMPACT_S + T.holdS + T.recoverS + 0.01)).toBe(0)
    const atImpact = tentacleFrame(frame(), T.slams[0] + SLAM_IMPACT_S, sinkAt, 0).bend
    expect(atImpact).toBeGreaterThan(T.slam - T.sway - 0.1)
  })

  it('reports each slam impact once, and none for a slam after it started sinking', () => {
    const at = T.slams[0] + SLAM_IMPACT_S
    expect(slamImpactBetween(at - 0.02, at, sinkAt, 0)).toBe(true)
    expect(slamImpactBetween(at, at + 0.02, sinkAt, 0)).toBe(false)
    expect(slamImpactBetween(at - 0.02, at, T.slams[0], 0)).toBe(false)
    expect(slamImpactBetween(at - 0.02, at, sinkAt, 1)).toBe(false)
    expect(slamImpactBetween(at + T.slamSpread - 0.02, at + T.slamSpread, sinkAt, 1)).toBe(true)
    for (let seed = 0; seed < T.count; seed++) {
      let impacts = 0
      for (let t = 0; t < sinkAt + T.sinkS; t += 1 / 60) if (slamImpactBetween(t, t + 1 / 60, sinkAt, seed)) impacts++
      expect(impacts, `tentacle ${seed}`).toBe(T.slams.length)
    }
  })

  it('a slam brings the tip down to the water, beside the base', () => {
    const chain = layChain(createChain(), 1, T.slam)
    const tipY = chain.y[T.segments]
    const top = Math.max(...chain.y)
    expect(tipY).toBeLessThan(20)
    expect(top).toBeGreaterThan(LENGTH * 0.25)
    expect(chain.u[T.segments]).toBeGreaterThan(LENGTH * 0.4)
  })

  it('stands out of the water with its tip hooked back towards the rider, and is wholly under it when down', () => {
    const up = layChain(createChain(), 1, 0)
    expect(up.u[T.segments]).toBeLessThan(-20)
    expect(up.y[T.segments]).toBeGreaterThan(LENGTH * 0.8)
    const down = layChain(createChain(), 0, 0.3)
    expect(Math.max(...down.y)).toBeLessThan(1)
  })
})

describe('head cycle', () => {
  it('rises out to the dome, bobs, and sinks back to its depth', () => {
    const out = { emerge: 0, y: 0 }
    expect(headFrame(out, -1, Infinity, 1).y).toBe(-KRAKEN_HEAD.depth)
    headFrame(out, KRAKEN_HEAD.riseS + 1, Infinity, 1)
    expect(out.emerge).toBeCloseTo(1)
    expect(Math.abs(out.y)).toBeLessThanOrEqual(KRAKEN_HEAD.bob)
    expect(headFrame(out, 10, 5, KRAKEN_HEAD.defeatSinkS).emerge).toBe(0)
  })
})

describe('Kraken spec', () => {
  it('exposes the five pads first, then only the eye', () => {
    let state = createBossState(KRAKEN)
    expect(exposedWeakPoints(state).map((w) => w.id)).toEqual(['pad-0', 'pad-1', 'pad-2', 'pad-3', 'pad-4'])
    for (const w of KRAKEN.weakPoints.filter((p) => p.phase === 0)) for (let h = 0; h < w.hp; h++) state = applyHit(state, w.id)
    expect(exposedWeakPoints(state).map((w) => w.id)).toEqual(['eye'])
    expect(KRAKEN.weakPoints.find((w) => w.id === 'eye')!.hp).toBe(3)
    expect(BOSS_SPECS.kraken).toBe(KRAKEN)
  })
})

describe('surfacing spots (level 3)', () => {
  const { varA, varB, varC, scalar } = getLevelConfig('level3')!.track
  const curve = createTrigCurve(varA, varB, varC, scalar)
  const table = buildArcTable(curve)
  const groundFn = createTerrainSurface(
    createHeightFunction('ocean', sampleTrackPath((t) => curve.getPointAt(t))),
    getTerrainMeshSize('ocean'),
  )
  const index = buildTrackIndex(table)
  const avoid = seaObstacles(oceanLayout(groundFn, table))
  const rng = createRng(7)

  const riders = Array.from({ length: 60 }, (_, i) => indexAhead(table, 0, (i / 60) * table.length))
  const view = (at: number) => {
    const t = trackTangent(table, at)
    const h = Math.hypot(t.x, t.z) || 1
    return { camera: { x: table.x[at], y: table.y[at] + 6, z: table.z[at] }, forwardX: t.x / h, forwardZ: t.z / h }
  }
  const picks = riders.map((at) => {
    const v = view(at)
    const taken: Spot[] = []
    for (let n = 0; n < T.count; n++) {
      const spot: Spot = { x: 0, z: 0, outX: 0, outZ: 0 }
      if (pickSpot(spot, { ...v, index, groundFn, rng, kind: 'tentacle', taken, avoid })) taken.push(spot)
    }
    return { ...v, taken }
  })

  it('finds room for three tentacles almost everywhere on the ride', () => {
    expect(picks.filter((p) => p.taken.length >= 3).length / picks.length).toBeGreaterThan(0.85)
  })

  it('surfaces the head at once almost everywhere, and within a few retries from anywhere on the ride', () => {
    let worst = 0
    let first = 0
    for (const start of riders) {
      let tries = 1
      for (let at = start; ; tries++) {
        const head: Spot = { x: 0, z: 0, outX: 0, outZ: 0 }
        if (pickSpot(head, { ...view(at), index, groundFn, rng, kind: 'head', taken: [], avoid })) {
          expect(index.near(head.x, head.z, 45 + KRAKEN_HEAD.rx * 0.65)).toBe(false)
          break
        }
        at = indexAhead(table, at, 30)
        if (tries > 50) break
      }
      worst = Math.max(worst, tries)
      if (tries === 1) first++
    }
    expect(first / riders.length).toBeGreaterThan(0.7)
    expect(worst).toBeLessThanOrEqual(16)
  })

  it('in front of the rider, never on the rails or a tower, in the water and off the sea stacks', () => {
    for (const { camera, forwardX, forwardZ, taken } of picks) {
      for (const s of taken) {
        expect(index.near(s.x, s.z, 45 + T.baseRadius)).toBe(false)
        expect(index.near(s.x + s.outX * LENGTH * 0.9, s.z + s.outZ * LENGTH * 0.9, 45)).toBe(false)
        expect(groundFn(s.x, s.z)).toBeLessThan(-8)
        const dist = Math.hypot(s.x - camera.x, s.z - camera.z)
        expect(dist).toBeGreaterThanOrEqual(SPOTS.tentacle.distMin)
        expect(((s.x - camera.x) * forwardX + (s.z - camera.z) * forwardZ) / dist).toBeGreaterThan(Math.cos(0.46))
        for (const a of avoid) expect(Math.hypot(a.x - s.x, a.z - s.z)).toBeGreaterThanOrEqual(a.r + T.baseRadius)
      }
      for (let i = 0; i < taken.length; i++)
        for (let j = i + 1; j < taken.length; j++)
          expect(Math.hypot(taken[i].x - taken[j].x, taken[i].z - taken[j].z)).toBeGreaterThanOrEqual(170)
    }
  })
})
