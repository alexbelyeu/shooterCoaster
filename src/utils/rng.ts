/** mulberry32 for layouts (fixed seeds) and spawns (run seed); `Math.random` stays for per-frame cosmetic jitter. */

/** Callable like `Math.random`, so it drops into any `() => number` parameter. */
export interface Rng {
  (): number
  next(): number
  range(min: number, max: number): number
  pick<T>(items: readonly T[]): T
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const rng = next as Rng
  rng.next = next
  rng.range = (min, max) => min + next() * (max - min)
  rng.pick = (items) => items[Math.floor(next() * items.length)]
  return rng
}

/** FNV-1a: a stable 32-bit seed from a string (e.g. `hashString('trees:desert')`). */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** `?seed=123` pins the run seed (any other text is hashed); null when absent or empty. */
export function seedFromQuery(search: string): number | null {
  const raw = new URLSearchParams(search).get('seed')?.trim()
  if (!raw) return null
  return /^\d+$/.test(raw) ? Number(raw) >>> 0 : hashString(raw)
}
