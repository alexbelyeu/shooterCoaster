import { describe, expect, it } from 'vitest'
import { applyHit, createBossState, currentPhase, exposedWeakPoints, hpFraction, setRetracted } from './bossModel'
import { MAGMA_TITAN } from './bossSpecs'
import type { TrackIndex } from '@/levels/environments/shared/trackClearance'
import type { PerchInput } from './scorpionMotion'
import {
  RIVER_SPOT, TITAN_BEAT, TITAN_DEFEAT, TITAN_RISE, beatNowEpoch, crackGlow, defeatHeat, defeatSink, heartOpenAmount,
  isHeartOpen, needsWade, pickRiverSpot, poundAmount, poundBetween, riseOffset, wadeStep,
} from './titanMotion'

const ids = (state: ReturnType<typeof createBossState>) => exposedWeakPoints(state).map((w) => w.id)

describe('Magma Titan phases', () => {
  it('vents and the heart first (the heart only while open), then the crown', () => {
    let s = createBossState(MAGMA_TITAN)
    expect(ids(s)).toEqual(['vent-l', 'vent-r', 'heart'])
    s = setRetracted(s, 'heart', true)
    expect(ids(s)).toEqual(['vent-l', 'vent-r'])
    for (const id of ['vent-l', 'vent-l', 'vent-r', 'vent-r']) s = applyHit(s, id)
    // Its vents gone, the shut heart still holds the first phase.
    expect(currentPhase(s)).toBe(0)
    expect(ids(s)).toEqual([])
    s = setRetracted(s, 'heart', false)
    s = applyHit(applyHit(s, 'heart'), 'heart')
    expect(ids(s)).toEqual(['crown'])
    for (let i = 0; i < 4; i++) s = applyHit(s, 'crown')
    expect(currentPhase(s)).toBe(-1)
  })

  it('the finale is worth its vents, heart and a 500 reward', () => {
    expect(MAGMA_TITAN.reward).toBe(500)
    expect(MAGMA_TITAN.weakPoints.reduce((n, w) => n + w.score, 0)).toBe(180)
  })
})

describe('the heart beat', () => {
  const { first, period, openS, poundS } = TITAN_BEAT

  it('is shut until the first beat, open for openS of every period', () => {
    expect(isHeartOpen(0)).toBe(false)
    expect(isHeartOpen(first - 0.01)).toBe(false)
    for (let k = 0; k < 4; k++) {
      expect(isHeartOpen(first + k * period + 0.01)).toBe(true)
      expect(isHeartOpen(first + k * period + openS - 0.01)).toBe(true)
      expect(isHeartOpen(first + k * period + openS + 0.01)).toBe(false)
    }
  })

  it('opens at least once in any ~5 s and for a good share of the fight', () => {
    let open = 0
    let longestShut = 0
    let shut = 0
    for (let t = first; t < first + 20; t += 0.05) {
      if (isHeartOpen(t)) {
        open += 0.05
        shut = 0
      } else longestShut = Math.max(longestShut, (shut += 0.05))
    }
    expect(longestShut).toBeLessThanOrEqual(period - openS + 0.06)
    expect(open / 20).toBeGreaterThan(0.35)
  })

  it('eases the plates open and shut inside the window', () => {
    expect(heartOpenAmount(first - 0.1)).toBe(0)
    expect(heartOpenAmount(first + openS / 2)).toBe(1)
    expect(heartOpenAmount(first + openS + 0.1)).toBe(0)
    const samples = Array.from({ length: 200 }, (_, i) => heartOpenAmount(first + (i / 200) * period))
    expect(samples.every((v) => v >= 0 && v <= 1)).toBe(true)
  })

  it('pounds twice at the start of each window', () => {
    expect(poundAmount(first + poundS / 4)).toBeCloseTo(1)
    expect(poundAmount(first + poundS + 0.1)).toBe(0)
    let impacts = 0
    for (let t = 0; t < first + period; t += 1 / 60) if (poundBetween(t, t + 1 / 60)) impacts++
    expect(impacts).toBe(2)
  })

  it('beats at once when asked (its vents gone)', () => {
    const now = 7.3
    expect(isHeartOpen(now - beatNowEpoch(now) + 0.01)).toBe(true)
  })
})

describe('crack glow', () => {
  it('dull at full hp, white-hot at 10% and below, rising with every hit', () => {
    expect(crackGlow(1)).toBe(0)
    expect(crackGlow(0.1)).toBe(1)
    expect(crackGlow(0)).toBe(1)
    let s = createBossState(MAGMA_TITAN)
    let last = crackGlow(hpFraction(s))
    for (const id of ['vent-l', 'vent-l', 'vent-r', 'vent-r', 'heart', 'heart', 'crown', 'crown', 'crown']) {
      s = applyHit(s, id)
      const glow = crackGlow(hpFraction(s))
      expect(glow).toBeGreaterThan(last)
      last = glow
    }
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

  it('wades on once behind or off to the side, or after holding', () => {
    expect(needsWade(1, 1400, 300)).toBe(false)
    expect(needsWade(1, 400, 0)).toBe(true)
    expect(needsWade(1, 800, 1500)).toBe(true)
    expect(needsWade(20, 1400, 300)).toBe(true)
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
