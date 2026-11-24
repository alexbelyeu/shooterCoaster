import type { TunnelSpan } from './setPieces'
import { smoothstep } from '@/utils/ease'

/** Index of the tunnel the arc distance `dist` is inside, or -1. */
export function tunnelAt(tunnels: readonly TunnelSpan[] | undefined, dist: number): number {
  if (!tunnels) return -1
  for (let i = 0; i < tunnels.length; i++) {
    if (dist >= tunnels[i].fromS && dist <= tunnels[i].toS) return i
  }
  return -1
}

/** How far into a tunnel `dist` is, 0 outside to 1 once `ramp` past its entry, easing back to 0 at its exit. */
export function tunnelDepth(tunnels: readonly TunnelSpan[] | undefined, dist: number, ramp: number): number {
  const i = tunnelAt(tunnels, dist)
  if (i < 0 || !tunnels) return 0
  const span = tunnels[i]
  return smoothstep(Math.min(dist - span.fromS, span.toS - dist) / Math.max(ramp, 1e-6))
}
