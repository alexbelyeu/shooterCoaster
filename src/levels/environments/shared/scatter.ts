import * as THREE from 'three'
import type { HeightFunction } from '@/utils/terrainNoise'

/** Scatter positions in an annular ring, rejecting steep slopes; pass a fixed-seed rng so the layout never changes. */
export function scatterPositions(
  rng: () => number,
  count: number,
  minR: number,
  maxR: number,
  heightFn: HeightFunction,
  maxSlope = Math.PI / 4,
): { x: number; y: number; z: number }[] {
  const arr: { x: number; y: number; z: number }[] = []
  let attempts = 0
  while (arr.length < count && attempts < count * 5) {
    attempts++
    const r = minR + rng() * (maxR - minR)
    const theta = rng() * Math.PI * 2
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    const y = heightFn(x, z)

    // Simple slope check
    const delta = 5
    const hx = heightFn(x + delta, z)
    const hz = heightFn(x, z + delta)
    const dx = (hx - y) / delta
    const dz = (hz - y) / delta
    const slope = Math.atan(Math.sqrt(dx * dx + dz * dz))
    if (slope > maxSlope) continue

    arr.push({ x, y, z })
  }
  return arr
}

/** Parse HSL string to RGB for instance color attribute */
export function hslToRgb(hsl: string): [number, number, number] {
  const c = new THREE.Color()
  c.setStyle(hsl)
  return [c.r, c.g, c.b]
}
