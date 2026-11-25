import { describe, expect, it } from 'vitest'
import { flyBack } from './leftBehind.hot'

// The module's numbers (written in place there).
const BEHIND_DISTANCE = 400
const AHEAD = 700
const UP = 80

const eye = { x: 0, y: 10, z: 0 }
const forward = { x: 0, y: 0, z: -1 }
const far = BEHIND_DISTANCE + 100
const STEP = 1 / 60

/** Whether a bird at `p`, flying on its own, turns to fly back. */
const turnsBack = (p: { x: number; y: number; z: number }) => flyBack({ flying: false }, { ...p }, eye, forward, STEP, 0) !== null

describe('flyBack', () => {
  it('turns a bird behind the look and past the distance round', () => {
    expect(turnsBack({ x: 0, y: 10, z: far })).toBe(true)
  })

  it('leaves one ahead of the look, one just behind (still passing overhead) and one square to it', () => {
    expect(turnsBack({ x: 0, y: 10, z: -10 * far })).toBe(false)
    expect(turnsBack({ x: 0, y: 10, z: BEHIND_DISTANCE - 50 })).toBe(false)
    expect(turnsBack({ x: far, y: 10, z: -1 })).toBe(false)
  })

  it('flies it round to out in front, in the middle of the look, then lets it go', () => {
    const p = { x: 300, y: 10, z: far }
    const s = { flying: false }
    let heading: number | null = null
    let flew = 0
    for (let i = 0; i < 2000; i++) {
      heading = flyBack(s, p, eye, forward, STEP, 0)
      if (heading !== null) flew++
      else if (flew) break
    }
    expect(flew).toBeGreaterThan(0)
    expect(heading).toBeNull()
    expect(Math.hypot(p.x, p.y - eye.y, p.z)).toBeGreaterThan(AHEAD / 2)
    expect(p.z).toBeLessThan(0)
    expect(Math.abs(p.x) / Math.abs(p.z)).toBeLessThan(0.5)
    expect(p.y).toBeGreaterThan(eye.y)
    expect(p.y).toBeLessThanOrEqual(eye.y + UP)
  })

  it('heads the way it flies, and outpaces a rider who rode `rode`', () => {
    const s = { flying: true }
    const p = { x: 0, y: eye.y + UP, z: far }
    expect(flyBack(s, p, eye, forward, STEP, 50)).toBeCloseTo(-Math.PI / 2)
    expect(p.z).toBeLessThan(far - 50)
  })
})
