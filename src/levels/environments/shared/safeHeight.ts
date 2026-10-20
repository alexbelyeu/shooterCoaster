import type { HeightFunction } from '@/utils/terrainNoise'

/**
 * Highest terrain value in a 3x3 neighbourhood (±`half` around the point) plus
 * `yOffset`. Terrain-conforming geometry (lava rivers, paths) must sit on this,
 * not on `heightFn` directly: the rendered terrain is linear between grid
 * vertices, so exact noise heights clip in and out of it.
 */
export function safeHeight(
  heightFn: HeightFunction,
  x: number,
  z: number,
  half: number,
  yOffset: number,
): number {
  let maxH = heightFn(x, z)
  // sample a cross pattern around the point
  for (const ox of [-half, 0, half]) {
    for (const oz of [-half, 0, half]) {
      const h = heightFn(x + ox, z + oz)
      if (h > maxH) maxH = h
    }
  }
  return maxH + yOffset
}
