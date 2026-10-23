import { describe, expect, it } from 'vitest'
import { scatterPositions } from './scatter'
import { createRng } from '@/utils/rng'

describe('scatterPositions', () => {
  const heightFn = (x: number, z: number) => Math.sin(x * 0.01) * 20 + Math.cos(z * 0.01) * 20

  it('gives the same layout for the same seed (stable across reloads)', () => {
    const a = scatterPositions(createRng(2330), 80, 300, 2800, heightFn)
    expect(a).toEqual(scatterPositions(createRng(2330), 80, 300, 2800, heightFn))
    expect(a).not.toEqual(scatterPositions(createRng(2331), 80, 300, 2800, heightFn))
  })

  it('stays inside the annulus', () => {
    for (const p of scatterPositions(createRng(1), 50, 300, 2800, heightFn)) {
      const r = Math.hypot(p.x, p.z)
      expect(r).toBeGreaterThanOrEqual(300)
      expect(r).toBeLessThan(2800)
    }
  })
})
