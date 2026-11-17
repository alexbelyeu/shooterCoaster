/** Smooth 1D value noise, shared by the camera shake and the Flame's flicker (pure, per-frame). */

/** Integer hash -> [-1, 1]. */
function hash1(n: number): number {
  let h = (n | 0) * 374761393
  h = (h ^ (h >>> 13)) * 1274126177
  h ^= h >>> 16
  return ((h >>> 0) / 4294967295) * 2 - 1
}

/** Smooth 1D value noise in [-1, 1] (quintic-interpolated lattice). */
export function smoothNoise1(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * f * (f * (f * 6 - 15) + 10)
  const s = (seed | 0) * 7919
  const a = hash1(i + s)
  const b = hash1(i + 1 + s)
  return a + (b - a) * u
}
