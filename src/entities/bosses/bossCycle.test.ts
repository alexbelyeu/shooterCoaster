import { describe, expect, it } from 'vitest'
import { HEADING_TAU, followHeading, inWindow, leadHeading, type LeadHeading, needsRelocate, timeToWindow, windowAmount, windowNowEpoch } from './bossCycle.hot'
import { TITAN_BEAT, TITAN_WADE } from './titanMotion.hot'
import { YETI_ROAM, YETI_ROAR } from './yetiMotion.hot'

describe.each([['the Yeti roar', YETI_ROAR], ['the Titan beat', TITAN_BEAT]])('%s window', (_, w) => {
  const { first, period, openS } = w

  it('is shut until the first, open for openS of every period', () => {
    expect(inWindow(w, 0)).toBe(false)
    expect(inWindow(w, first - 0.01)).toBe(false)
    for (let k = 0; k < 4; k++) {
      expect(inWindow(w, first + k * period + 0.01)).toBe(true)
      expect(inWindow(w, first + k * period + openS - 0.01)).toBe(true)
      expect(inWindow(w, first + k * period + openS + 0.01)).toBe(false)
    }
  })

  it('eases in and out inside the window', () => {
    expect(windowAmount(w, first - 0.1)).toBe(0)
    expect(windowAmount(w, first + openS / 2)).toBe(1)
    expect(windowAmount(w, first + openS + 0.1)).toBe(0)
    const samples = Array.from({ length: 200 }, (_, i) => windowAmount(w, first + (i / 200) * period))
    expect(samples.every((v) => v >= 0 && v <= 1)).toBe(true)
  })

  it('counts down to the next window, 0 while open', () => {
    expect(timeToWindow(w, 0)).toBeCloseTo(first)
    expect(timeToWindow(w, first + openS / 2)).toBe(0)
    expect(timeToWindow(w, first + openS + 0.5)).toBeCloseTo(period - openS - 0.5)
  })

  it('opens at once when asked', () => {
    const now = 7.3
    expect(inWindow(w, now - windowNowEpoch(w, now) + 0.01)).toBe(true)
  })
})

describe('needsRelocate', () => {
  it('the Yeti moves on when the rider nears its ridge, it slips off the view or has held it long', () => {
    expect(needsRelocate(YETI_ROAM, 1, 1200, 400)).toBe(false)
    expect(needsRelocate(YETI_ROAM, YETI_ROAM.holdS, 1200, 400)).toBe(true)
    expect(needsRelocate(YETI_ROAM, 1, YETI_ROAM.minAhead - 1, 0)).toBe(true)
    expect(needsRelocate(YETI_ROAM, 1, 600, 1200)).toBe(true)
  })

  it('the Titan wades on once behind or off to the side, or after holding', () => {
    expect(needsRelocate(TITAN_WADE, 1, 1400, 300)).toBe(false)
    expect(needsRelocate(TITAN_WADE, 1, 400, 0)).toBe(true)
    expect(needsRelocate(TITAN_WADE, 1, 800, 1500)).toBe(true)
    expect(needsRelocate(TITAN_WADE, 20, 1400, 300)).toBe(true)
  })
})

describe('followHeading', () => {
  it('snaps on the first call, then eases towards the view and stays unit length', () => {
    const h = { x: 0, z: 0 }
    followHeading(h, 1, 0, 0.016, true)
    expect(h).toEqual({ x: 1, z: 0 })
    followHeading(h, 0, 1, 0.5, false)
    expect(h.x).toBeGreaterThan(0.5)
    expect(h.z).toBeGreaterThan(0)
    expect(Math.hypot(h.x, h.z)).toBeCloseTo(1)
    for (let i = 0; i < 60; i++) followHeading(h, 0, 1, 1, false)
    expect(h.z).toBeCloseTo(1)
  })

  it('a reversal through a loop that would cancel it out takes the view instead', () => {
    const h = { x: 1, z: 0 }
    followHeading(h, -1, 0, HEADING_TAU * Math.LN2, false)
    expect(h).toEqual({ x: -1, z: 0 })
  })
})

describe('leadHeading', () => {
  const timing = { rateTau: 0.5, headingTau: 0.4, lead: 0.4 }
  const dt = 1 / 60
  /** Degrees the heading is off the view after `seconds` of turning at `rate` radians a second from +x. */
  function offAfter(seconds: number, rate: number, follow: (h: LeadHeading, fx: number, fz: number, snap: boolean) => void): number {
    const h = { x: 0, z: 0, rate: 0, lastX: 0, lastZ: 0 }
    let worst = 0
    for (let i = 0; i * dt <= seconds; i++) {
      const a = rate * i * dt
      follow(h, Math.cos(a), Math.sin(a), i === 0)
      if (i * dt > 2) worst = Math.max(worst, Math.abs(Math.atan2(h.x * Math.sin(a) - h.z * Math.cos(a), h.x * Math.cos(a) + h.z * Math.sin(a))))
    }
    return (worst * 180) / Math.PI
  }

  it("holds the view through the park finale's steady turn, where following it trails round behind", () => {
    expect(offAfter(8, 1, (h, fx, fz, snap) => leadHeading(h, fx, fz, dt, snap, timing))).toBeLessThan(5)
    expect(offAfter(8, -1, (h, fx, fz, snap) => leadHeading(h, fx, fz, dt, snap, timing))).toBeLessThan(5)
    expect(offAfter(8, 1, (h, fx, fz, snap) => followHeading(h, fx, fz, dt, snap))).toBeGreaterThan(90)
  })

  it('settles on the view on a straight and stays unit length', () => {
    const h = { x: 0, z: 0, rate: 0, lastX: 0, lastZ: 0 }
    leadHeading(h, 1, 0, dt, true, timing)
    for (let i = 0; i < 300; i++) leadHeading(h, 0, 1, dt, false, timing)
    expect(h.z).toBeCloseTo(1)
    expect(Math.hypot(h.x, h.z)).toBeCloseTo(1)
  })
})
