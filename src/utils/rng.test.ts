import { describe, expect, it } from 'vitest'
import { createRng, hashString, seedFromQuery } from './rng'

describe('createRng', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = createRng(7)
    const b = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const v = a()
      expect(v).toBe(b.next())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('keeps the mulberry32 stream existing seeded layouts were built with', () => {
    const rng = createRng(77)
    expect([rng(), rng(), rng()].map((v) => v.toFixed(8))).toEqual(['0.42560136', '0.04221976', '0.69600673'])
  })

  it('gives different streams for different seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)())
  })

  it('range and pick stay in bounds', () => {
    const rng = createRng(3)
    const items = ['a', 'b', 'c'] as const
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) {
      const v = rng.range(-5, 5)
      expect(v).toBeGreaterThanOrEqual(-5)
      expect(v).toBeLessThan(5)
      seen.add(rng.pick(items))
    }
    expect(seen).toEqual(new Set(items))
  })
})

describe('hashString', () => {
  it('is stable and spreads similar strings', () => {
    expect(hashString('trees:desert')).toBe(hashString('trees:desert'))
    expect(hashString('trees:desert')).not.toBe(hashString('trees:arctic'))
    expect(hashString('')).toBe(0x811c9dc5)
  })
})

describe('seedFromQuery', () => {
  it('reads numeric seeds, hashes words and ignores a missing param', () => {
    expect(seedFromQuery('?seed=123')).toBe(123)
    expect(seedFromQuery('?e2e=1&seed=daily')).toBe(hashString('daily'))
    expect(seedFromQuery('?e2e=1')).toBeNull()
    expect(seedFromQuery('?seed=')).toBeNull()
  })
})
