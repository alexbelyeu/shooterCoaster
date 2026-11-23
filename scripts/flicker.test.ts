import { describe, expect, it } from 'vitest'
import { flickerSpikes, regionMeans } from './flicker.mjs'

const frame = (t: number, value: (x: number, y: number) => number) => {
  const width = 16
  const height = 12
  const luma = new Float32Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) luma[y * width + x] = value(x, y)
  return { t, width, height, luma }
}

describe('flicker', () => {
  it('averages each region', () => {
    const m = regionMeans(frame(0, (x) => (x < 8 ? 0 : 100)))
    expect(m[0]).toBe(0)
    expect(m[7]).toBe(100)
  })

  it('finds a region that lights up for one step and goes back', () => {
    const base = 60
    const probes = [0, 1, 2, 3, 4, 5].map((i) => frame(i / 10, (x, y) => (i === 2 && y < 2 && x < 2 ? base + 80 : base)))
    const spikes = flickerSpikes(probes)
    expect(spikes).toHaveLength(1)
    expect(spikes[0]).toMatchObject({ region: 'top 1/8', count: 1, first: 0.2 })
  })

  it('a steady fade or a lasting change is no flicker', () => {
    const fade = [0, 1, 2, 3, 4, 5].map((i) => frame(i / 10, () => 40 + i * 25))
    const change = [0, 1, 2, 3].map((i) => frame(i / 10, () => (i >= 2 ? 160 : 40)))
    expect(flickerSpikes(fade)).toEqual([])
    expect(flickerSpikes(change)).toEqual([])
  })
})
