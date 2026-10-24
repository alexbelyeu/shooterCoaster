import { describe, expect, it } from 'vitest'
import { ATMOSPHERES } from '@/levels/environments/atmosphere'
import { hueOf, LUMA, NEUTRAL_GRADE, whiteBalanceGains, type Rgb } from './colourGrade'

const luma = (c: Rgb) => c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2]

describe('whiteBalanceGains', () => {
  it('is identity at 0 / 0', () => {
    whiteBalanceGains(0, 0).forEach((g) => expect(g).toBeCloseTo(1))
  })

  it('warms with positive temperature and cools with negative, keeping grey luminance', () => {
    const warm = whiteBalanceGains(0.5, 0)
    const cool = whiteBalanceGains(-0.5, 0)
    expect(warm[0]).toBeGreaterThan(warm[2])
    expect(cool[2]).toBeGreaterThan(cool[0])
    expect(luma(warm)).toBeCloseTo(1)
    expect(luma(cool)).toBeCloseTo(1)
  })

  it('positive tint is magenta (less green)', () => {
    const [r, g, b] = whiteBalanceGains(0, 0.5)
    expect(g).toBeLessThan(r)
    expect(g).toBeLessThan(b)
  })
})

describe('hueOf', () => {
  it('normalises any colour to luminance 1', () => {
    for (const hex of [0xff8a3a, 0x1e4ea8, 0x123456, 0xffffff]) {
      expect(luma(hueOf(hex))).toBeCloseTo(1)
    }
  })

  it('grey and black are neutral', () => {
    hueOf(0x808080).forEach((c) => expect(c).toBeCloseTo(1))
    expect(hueOf(0x000000)).toEqual([1, 1, 1])
  })
})

describe('biome grades', () => {
  it('stay in sane ranges', () => {
    for (const [biome, { grade }] of Object.entries(ATMOSPHERES)) {
      expect(Object.keys(grade).sort(), biome).toEqual(Object.keys(NEUTRAL_GRADE).sort())
      expect(grade.exposure, biome).toBeGreaterThan(0.5)
      expect(grade.exposure, biome).toBeLessThan(1.5)
      expect(Math.abs(grade.temperature), biome).toBeLessThanOrEqual(1)
      expect(Math.abs(grade.tint), biome).toBeLessThanOrEqual(1)
      expect(grade.contrast, biome).toBeGreaterThan(0.8)
      expect(grade.contrast, biome).toBeLessThan(1.3)
      expect(grade.saturation, biome).toBeGreaterThan(0.7)
      expect(grade.saturation, biome).toBeLessThan(1.3)
      expect(grade.splitTone, biome).toBeGreaterThanOrEqual(0)
      expect(grade.splitTone, biome).toBeLessThanOrEqual(1)
      expect(grade.vignette, biome).toBeGreaterThanOrEqual(0)
      expect(grade.vignette, biome).toBeLessThan(0.6)
    }
  })
})
