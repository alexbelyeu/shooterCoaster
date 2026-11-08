import type { HeightFunction } from '@/utils/terrainNoise'

/** Heights the water's seabed texture can hold; the sea's shades all change between these. */
export const SEABED_MIN_Y = -60
export const SEABED_MAX_Y = 20

/** Byte for one terrain height: 0 at `SEABED_MIN_Y`, 255 at `SEABED_MAX_Y`, clamped. */
export function encodeSeabedHeight(y: number): number {
  const t = (y - SEABED_MIN_Y) / (SEABED_MAX_Y - SEABED_MIN_Y)
  return Math.round(Math.min(1, Math.max(0, t)) * 255)
}

/**
 * The terrain's height at each vertex of its drawn grid (`segments` cells over `size`, centred on the
 * origin), row-major in z: one texel per vertex, so a linearly filtered texture reproduces the drawn ground.
 */
export function seabedHeightTexels(groundFn: HeightFunction, size: number, segments: number): Uint8Array {
  const n = segments + 1
  const cell = size / segments
  const half = size / 2
  const data = new Uint8Array(n * n)
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) data[iz * n + ix] = encodeSeabedHeight(groundFn(-half + ix * cell, -half + iz * cell))
  }
  return data
}

/**
 * Vertex coordinates along one axis of the water grid, symmetric about 0: `innerCells` (even) equal cells
 * over ±`innerHalf`, where the ride is and the swell shows, then `outerCells` each side growing
 * geometrically out to ±`outerHalf`, so the sea reaches the horizon for few triangles.
 */
export function waterGridCoords(innerHalf: number, innerCells: number, outerHalf: number, outerCells: number): number[] {
  const inner = (2 * innerHalf) / innerCells
  const reach = (ratio: number) => {
    let sum = 0
    for (let i = 1; i <= outerCells; i++) sum += inner * ratio ** i
    return sum
  }
  // The growth ratio that ends the last cell at outerHalf, by bisection.
  let lo = 1
  let hi = 4
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (reach(mid) < outerHalf - innerHalf) lo = mid
    else hi = mid
  }
  const half = Array.from({ length: innerCells / 2 + 1 }, (_, i) => i * inner)
  let x = innerHalf
  for (let i = 1; i <= outerCells; i++) half.push(i === outerCells ? outerHalf : (x += inner * lo ** i))
  return [...half.slice(1).reverse().map((v) => -v), ...half]
}
