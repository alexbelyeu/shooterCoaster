import type { SeaArchSpec } from '@/types/level'

/**
 * The sea arch (#865), pure: a part-torus of rock standing across the rails in the plane square to them, its centreline a
 * circle round the opening. Its legs run on past the horizontal by `ARCH_LEG_ANGLE`, so their open ends sit under the water.
 */
export const ARCH_TUBE = 14
export const ARCH_LEG_ANGLE = 0.75
/** The rock is this much thicker along the rails than across: a slab, not a ring. */
export const ARCH_DEPTH = 1.8
/** How far each corner of the rock is knocked about on each axis, so it reads as weathered stone, not a pipe. */
export const ARCH_JITTER = 3.5

/** Radius of the arch's centreline and the world y of its centre. */
export function seaArchShape(spec: SeaArchSpec): { radius: number; centreY: number } {
  return { radius: spec.span / 2 + ARCH_TUBE, centreY: spec.crownY - spec.span / 2 }
}

/** About how far `p` is from the arch's rock (negative inside it); under the true distance, so a clearance kept on it holds. */
export function seaArchClearance(spec: SeaArchSpec, p: { x: number; y: number; z: number }): number {
  const { radius, centreY } = seaArchShape(spec)
  const hx = Math.sin(spec.heading)
  const hz = Math.cos(spec.heading)
  const dx = p.x - spec.x
  const dz = p.z - spec.z
  const along = (dx * hx + dz * hz) / ARCH_DEPTH
  const across = dx * hz - dz * hx
  const up = p.y - centreY
  // The nearest point of the centreline: round to the point's angle, or the nearer leg's end past the arc.
  let a = Math.atan2(up, across)
  if (a < -ARCH_LEG_ANGLE && a > -Math.PI + ARCH_LEG_ANGLE) a = a > -Math.PI / 2 ? -ARCH_LEG_ANGLE : -Math.PI + ARCH_LEG_ANGLE
  return Math.hypot(across - radius * Math.cos(a), up - radius * Math.sin(a), along) - ARCH_TUBE - Math.sqrt(3) * ARCH_JITTER
}
