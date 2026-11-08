import { describe, expect, it } from 'vitest'
import { SEABED_MAX_Y, SEABED_MIN_Y, encodeSeabedHeight, seabedHeightTexels, waterGridCoords } from './waterSurface'

describe('water grid', () => {
  it('spaces the inner cells evenly, then grows them out to the edge', () => {
    const xs = waterGridCoords(3000, 80, 12000, 10)
    expect(xs).toHaveLength(101)
    expect(xs[0]).toBe(-12000)
    expect(xs[50]).toBe(0)
    expect(xs[100]).toBe(12000)
    for (let i = 10; i < 90; i++) expect(xs[i + 1] - xs[i]).toBeCloseTo(75, 6)
    for (let i = 90; i < 100; i++) expect(xs[i + 1] - xs[i]).toBeGreaterThan(xs[i] - xs[i - 1])
    for (let i = 0; i <= 100; i++) expect(xs[i]).toBeCloseTo(-xs[100 - i], 6)
  })
})

describe('seabed heights', () => {
  it('encodes the range into a byte, clamping outside it', () => {
    expect(encodeSeabedHeight(SEABED_MIN_Y)).toBe(0)
    expect(encodeSeabedHeight(SEABED_MAX_Y)).toBe(255)
    expect(encodeSeabedHeight(-500)).toBe(0)
    expect(encodeSeabedHeight(500)).toBe(255)
    // The surface (y = 0) decodes back within a byte's step.
    const back = SEABED_MIN_Y + (encodeSeabedHeight(0) / 255) * (SEABED_MAX_Y - SEABED_MIN_Y)
    expect(Math.abs(back)).toBeLessThan((SEABED_MAX_Y - SEABED_MIN_Y) / 255)
  })

  it('samples one texel per grid vertex, row-major in z', () => {
    // Height = x / 100 - 40 + z / 1000: x moves along a row, z picks the row.
    const data = seabedHeightTexels((x, z) => x / 100 - 40 + z / 1000, 4000, 4)
    expect(data).toHaveLength(25)
    expect(data[0]).toBe(encodeSeabedHeight(-2000 / 100 - 40 - 2))
    expect(data[4]).toBe(encodeSeabedHeight(2000 / 100 - 40 - 2))
    expect(data[20]).toBe(encodeSeabedHeight(-2000 / 100 - 40 + 2))
  })
})
