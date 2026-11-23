import { describe, expect, it } from 'vitest'
import { MACHADO, deltaE, glowColour, hexToLinear, linearToHex, linearToOklab, simulate } from './colourVision'

describe('colourVision', () => {
  it('converts sRGB to OKLab as Ottosson’s reference values', () => {
    // https://bottosson.github.io/posts/oklab/ (the sRGB primaries' OKLab coordinates)
    const close = (hex: number, lab: [number, number, number]) =>
      linearToOklab(hexToLinear(hex)).forEach((v, i) => expect(v).toBeCloseTo(lab[i], 3))
    close(0xffffff, [1, 0, 0])
    close(0xff0000, [0.62796, 0.22486, 0.12585])
    close(0x00ff00, [0.86644, -0.23389, 0.1795])
    close(0x0000ff, [0.45201, -0.03246, -0.31153])
  })

  it('round-trips sRGB hex through linear light', () => {
    for (const c of [0x000000, 0x123456, 0x9a968e, 0xffffff]) expect(linearToHex(hexToLinear(c))).toBe(c)
  })

  it('leaves greys alone under every dichromacy (Machado rows sum to 1)', () => {
    for (const m of Object.values(MACHADO)) for (const row of m) expect(row[0] + row[1] + row[2]).toBeCloseTo(1, 5)
    for (const grey of [0x000000, 0x777777, 0xffffff]) {
      expect(deltaE(grey, 0x777777, 'deuteranopia')).toBeCloseTo(deltaE(grey, 0x777777), 4)
    }
  })

  it('simulates deuteranopia of the primaries as Machado 2009’s matrix', () => {
    // Pure red is the matrix's first column, a dark olive to a deuteranope; pure blue loses its negative red term.
    expect(simulate([1, 0, 0], 'deuteranopia')).toEqual([0.367322, 0.280085, 0])
    expect(linearToHex(simulate([1, 0, 0], 'deuteranopia'))).toBe(0xa39000)
    expect(simulate([0, 0, 1], 'protanopia')).toEqual([0, 0.099216, 1])
  })

  it('collapses the red-green confusion line and keeps the blue-yellow one', () => {
    // A red and a green of matched lightness: far apart to normal vision, near one colour to a deuteranope.
    expect(deltaE(0xc05050, 0x709050)).toBeGreaterThan(0.1)
    expect(deltaE(0xc05050, 0x709050, 'deuteranopia')).toBeLessThan(0.04)
    // Blue against yellow survives either dichromacy.
    expect(deltaE(0x3060ff, 0xffd040, 'deuteranopia')).toBeGreaterThan(0.4)
    expect(deltaE(0x3060ff, 0xffd040, 'protanopia')).toBeGreaterThan(0.4)
  })

  it('adds an untone-mapped glow in linear light, saturating at white', () => {
    expect(glowColour(0x000000, 0x000000, 3)).toBe(0x000000)
    expect(glowColour(0xffd700, 0xffd700, 1.5)).toBe(0xffff00)
    expect(glowColour(0x808080, 0xffffff, 0)).toBe(0x808080)
  })
})
