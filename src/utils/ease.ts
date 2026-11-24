/** 0 → 1 over `x` 0 → 1 with zero slope at both ends; clamped outside. */
export function smoothstep(x: number): number {
  const t = Math.min(Math.max(x, 0), 1)
  return t * t * (3 - 2 * t)
}
