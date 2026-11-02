// Desert landmark sizes: what draws them and what keeps clear of, occludes or shadows them read the same numbers.

/** Stepped pyramid: square layers, each `PYRAMID_SHRINK` × the width of the one below. */
export const PYRAMID_LAYER_COUNT = 8
export const PYRAMID_BASE_SIZE = 800
export const PYRAMID_LAYER_HEIGHT = 80
export const PYRAMID_SHRINK = 0.82
export const PYRAMID_HALF_BASE = PYRAMID_BASE_SIZE / 2
/** Half-diagonal of the base: the farthest the pyramid reaches from its centre. */
export const PYRAMID_REACH = PYRAMID_HALF_BASE * Math.SQRT2
/** Top of the stepped layers; the capstone floats above. */
export const PYRAMID_HEIGHT = PYRAMID_LAYER_COUNT * PYRAMID_LAYER_HEIGHT

/** Rock arch at scale 1: two pillars `ARCH_RADIUS` either side of centre, a half-torus on top. */
export const ARCH_RADIUS = 120
export const ARCH_PILLAR_HEIGHT = 200
export const ARCH_PILLAR_RADIUS = 20
export const ARCH_PILLAR_BASE_RADIUS = ARCH_PILLAR_RADIUS * 1.3
export const ARCH_REACH = ARCH_RADIUS + ARCH_PILLAR_BASE_RADIUS

export interface ArchConfig {
  pos: readonly [number, number, number]
  rotY: number
  scale: number
}

/** World XZ of an arch's two pillar bases (local ±x rotated by `rotY`, as the group draws them). */
export function archFeet(a: ArchConfig): { x: number; z: number }[] {
  const r = ARCH_RADIUS * a.scale
  const cos = Math.cos(a.rotY)
  const sin = Math.sin(a.rotY)
  return [-1, 1].map((side) => ({ x: a.pos[0] + side * r * cos, z: a.pos[2] - side * r * sin }))
}
