import { describe, expect, it } from 'vitest'
import { sunOcclusion, type Occluder } from './sunOcclusion'

const len = Math.hypot(1, 0.2)
const sun = { x: 1 / len, y: 0.2 / len, z: 0 }
const eye = { x: 0, y: 50, z: 0 }
const flat = () => 0

describe('sunOcclusion', () => {
  it('sees a low sun over flat ground', () => {
    expect(sunOcclusion(eye, sun, flat, [])).toBe(0)
  })

  it('hides it behind a ridge on the sun side only', () => {
    const ridge = (x: number) => (x > 1000 && x < 1400 ? 400 : 0)
    expect(sunOcclusion(eye, sun, ridge, [])).toBe(1)
    expect(sunOcclusion(eye, { x: -sun.x, y: sun.y, z: 0 }, ridge, [])).toBe(0)
  })

  it('hides it behind a mesa in line, not one off to the side, behind or below the ray', () => {
    const mesa = (x: number, z: number, topY = 300): Occluder => ({ x, z, baseY: 0, topY, baseR: 100, topR: 60 })
    expect(sunOcclusion(eye, sun, flat, [mesa(800, 0)])).toBe(1)
    expect(sunOcclusion(eye, sun, flat, [mesa(800, 300)])).toBe(0)
    expect(sunOcclusion(eye, sun, flat, [mesa(-800, 0)])).toBe(0)
    expect(sunOcclusion(eye, sun, flat, [mesa(800, 0, 150)])).toBe(0)
  })
})
