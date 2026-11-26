import { describe, expect, it } from 'vitest'
import { applyHit, createBossState, currentPhase, exposedWeakPoints, hpFraction, setRetracted } from './bossModel'
import { MAGMA_TITAN } from './bossSpecs'
import type { TrackIndex } from '@/levels/environments/shared/trackClearance'
import type { PerchInput } from './scorpionMotion.hot'
import { inWindow } from './bossCycle.hot'
import {
  RIVER_SPOT, TITAN_BEAT, TITAN_DEFEAT, TITAN_RISE, crackGlow, defeatHeat, defeatSink, pickRiverSpot, poundAmount,
  poundBetween, riseOffset, titanShut, wadeStep,
} from './titanMotion.hot'

const ids = (state: ReturnType<typeof createBossState>) => exposedWeakPoints(state).map((w) => w.id)
const hpOf = (id: string) => MAGMA_TITAN.weakPoints.find((w) => w.id === id)!.hp
const hitDown = (state: ReturnType<typeof createBossState>, id: string) => {
  for (let i = hpOf(id); i > 0; i--) state = applyHit(state, id)
  return state
}

describe('Magma Titan phases', () => {
  it('vents and the heart first (the heart only while open), then the crown', () => {
    let s = createBossState(MAGMA_TITAN)
    expect(ids(s)).toEqual(['vent-l', 'vent-r', 'heart'])
    s = setRetracted(s, 'heart', true)
    expect(ids(s)).toEqual(['vent-l', 'vent-r'])
    s = hitDown(hitDown(s, 'vent-l'), 'vent-r')
    // Its vents gone, the shut heart still holds the first phase.
    expect(currentPhase(s)).toBe(0)
    expect(ids(s)).toEqual([])
    s = hitDown(setRetracted(s, 'heart', false), 'heart')
    expect(ids(s)).toEqual(['crown'])
    s = hitDown(s, 'crown')
    expect(currentPhase(s)).toBe(-1)
  })

  it('shuts on the beat (#1059): the vents while the parted chest shows the heart, never with nothing open', () => {
    const { first, period, poundS } = TITAN_BEAT
    for (let t = first; t < first + 2 * period; t += 0.05) {
      const open = inWindow(TITAN_BEAT, t)
      const parted = open && (t - first) % period >= poundS
      expect(titanShut('heart', t, true)).toBe(!open)
      expect(titanShut('vent-l', t, true)).toBe(parted)
      expect(titanShut('vent-r', t, true)).toBe(parted)
      // Its heart out, the vents stay open.
      expect(titanShut('vent-l', t, false)).toBe(false)
      expect(titanShut('crown', t, false)).toBe(false)
    }
  })

  it('the finale is worth its vents, heart and a 500 reward', () => {
    expect(MAGMA_TITAN.reward).toBe(500)
    expect(MAGMA_TITAN.weakPoints.reduce((n, w) => n + w.score, 0)).toBe(180)
  })
})

describe('the heart beat', () => {
  const { first, period, openS, poundS } = TITAN_BEAT

  it('opens at least once in any ~5 s and for a good share of the fight', () => {
    let open = 0
    let longestShut = 0
    let shut = 0
    for (let t = first; t < first + 20; t += 0.05) {
      if (inWindow(TITAN_BEAT, t)) {
        open += 0.05
        shut = 0
      } else longestShut = Math.max(longestShut, (shut += 0.05))
    }
    expect(longestShut).toBeLessThanOrEqual(period - openS + 0.06)
    expect(open / 20).toBeGreaterThan(0.35)
  })

  it('pounds twice at the start of each window', () => {
    expect(poundAmount(first + poundS / 4)).toBeCloseTo(1)
    expect(poundAmount(first + poundS + 0.1)).toBe(0)
    let impacts = 0
    for (let t = 0; t < first + period; t += 1 / 60) if (poundBetween(t, t + 1 / 60)) impacts++
    expect(impacts).toBe(2)
  })
})

describe('crack glow', () => {
  it('dull at full hp, white-hot at 10% and below, rising with every hit', () => {
    expect(crackGlow(1)).toBe(0)
    expect(crackGlow(0.1)).toBe(1)
    expect(crackGlow(0)).toBe(1)
    let s = createBossState(MAGMA_TITAN)
    let last = crackGlow(hpFraction(s))
    // Every hit while above the 10% where it saturates.
    const hits = MAGMA_TITAN.weakPoints.flatMap((w) => Array<string>(w.hp).fill(w.id))
    for (const id of hits) {
      if (hpFraction(s) <= 0.1) break
      s = applyHit(s, id)
      const glow = crackGlow(hpFraction(s))
      if (hpFraction(s) > 0.1) expect(glow).toBeGreaterThan(last)
      last = glow
    }
    expect(last).toBe(1)
  })

  it('goes black on defeat, flashes once, then stays dark', () => {
    expect(defeatHeat(-1)).toBe(1)
    expect(defeatHeat(TITAN_DEFEAT.darkS - 0.01)).toBeLessThan(0.05)
    expect(defeatHeat(TITAN_DEFEAT.darkS + TITAN_DEFEAT.flashS / 2)).toBeGreaterThan(2)
    expect(defeatHeat(TITAN_DEFEAT.darkS + TITAN_DEFEAT.flashS + 0.1)).toBe(0)
  })
})

describe('rise, sink and wade', () => {
  it('climbs out of the lava to knee-deep, and sinks after its break', () => {
    expect(riseOffset(0)).toBe(-TITAN_RISE.depth - TITAN_RISE.wadeDepth)
    expect(riseOffset(TITAN_RISE.riseS)).toBe(-TITAN_RISE.wadeDepth)
    expect(defeatSink(-1)).toBe(0)
    expect(defeatSink(TITAN_DEFEAT.darkS)).toBeCloseTo(0)
    expect(defeatSink(10)).toBe(-TITAN_DEFEAT.sinkDepth)
  })

  it('steps at its wade speed and lands on the target', () => {
    const p = { x: 0, z: 0 }
    expect(wadeStep(p, { x: 1000, z: 0 }, 0.5)).toBe(false)
    expect(p.x).toBeGreaterThan(0)
    expect(p.x).toBeLessThan(1000)
    expect(wadeStep(p, { x: 1000, z: 0 }, 100)).toBe(true)
    expect(p).toEqual({ x: 1000, z: 0 })
  })
})

describe('pickRiverSpot', () => {
  const clearIndex: TrackIndex = { near: () => false } as unknown as TrackIndex
  const input = (index = clearIndex): PerchInput => ({ index, avoid: [], camera: { x: 0, z: 0 }, forwardX: 0, forwardZ: -1 })

  it('picks the river point nearest the ideal distance ahead, in view', () => {
    const river = [
      { x: 0, z: 500 }, // behind
      { x: 0, z: -600 }, // too near
      { x: 1500, z: -1200 }, // off to the side
      { x: 100, z: -1700 },
      { x: 0, z: -2400 }, // too far
      { x: 50, z: -1450 },
    ]
    const out = { x: 0, z: 0 }
    expect(pickRiverSpot(out, input(), river)).toBe(true)
    expect(out).toEqual({ x: 100, z: -1700 })
  })

  it('skips spots on the track and reports none when nothing fits', () => {
    const river = [{ x: 0, z: -RIVER_SPOT.ideal }]
    const blocked = { near: () => true } as unknown as TrackIndex
    const out = { x: 7, z: 7 }
    expect(pickRiverSpot(out, input(blocked), river)).toBe(false)
    expect(out).toEqual({ x: 7, z: 7 })
  })
})
