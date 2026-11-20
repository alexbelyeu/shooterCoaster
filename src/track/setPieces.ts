import type { TunnelSpec } from '@/types/level'
import { type ArcTable, distanceAtT } from './arcLength'

/**
 * Track set-pieces (#332): tunnels, stretches where the track dives through a lit tube. A tunnel is data on
 * `TrackParams.tunnels`; this module places it on the arc table (`withTunnels`, which `trackClearance.ts`, the
 * camera and the e2e hook read back off the table). Pure: no three; `tunnelGeometry.ts` builds the mesh.
 */

/** Bus event as the car enters or leaves a tunnel: `(kind: 'enter' | 'exit', tunnel: number)`, the index in `ArcTable.tunnels`. */
export const TRACK_TUNNEL_EVENT = 'track:tunnel'

/** A tunnel's place on the track. */
export interface TunnelSpan {
  /** Arc distance of its entry and exit. */
  fromS: number
  toS: number
  /** First and last arc-table sample inside it. */
  from: number
  to: number
  /** How far from the centreline (XZ) the tube and its portals reach: `trackClearance.ts` keeps props out of it. */
  reach: number
}

/** Tube sizes in world units, all × `trackScale` (the rider's eye is 6 above the rails). */
export interface TunnelDims {
  /** Inner radius, round a centre `centreUp` above the rails. */
  radius: number
  centreUp: number
  /** Shell thickness. */
  wall: number
  /** Light rings: one every `ribSpacing` of arc, `ribLength` long, standing `ribDepth` in from the wall. */
  ribSpacing: number
  ribLength: number
  ribDepth: number
  /** The portal frame round each end: `portalWidth` past the shell, `portalDepth` along the track. */
  portalWidth: number
  portalDepth: number
  /** Arc step between the inner wall's rings (its light spill is sampled there). */
  ringStep: number
  /** The camera's tunnel effects ease in and out over this much arc at each end. */
  ramp: number
}

export function getTunnelDims(trackScale: number): TunnelDims {
  const s = trackScale
  return {
    radius: 10 * s,
    centreUp: 4 * s,
    wall: 1.2 * s,
    ribSpacing: 16 * s,
    ribLength: 0.9 * s,
    ribDepth: 0.8 * s,
    portalWidth: 3 * s,
    portalDepth: 3 * s,
    ringStep: 4 * s,
    ramp: 30 * s,
  }
}

/** First arc-table sample at or past arc distance `dist`. */
export function sampleAtOrAfter(table: ArcTable, dist: number): number {
  let lo = 0
  let hi = table.count - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (table.s[mid] < dist) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Each spec placed on the table, in ride order; throws on a tunnel that crosses the seam, overlaps another or has no portal room. */
export function tunnelSpans(table: ArcTable, specs: readonly TunnelSpec[], trackScale: number): TunnelSpan[] {
  const dims = getTunnelDims(trackScale)
  const reach = dims.radius + dims.wall + dims.portalWidth
  const spans = specs
    .map((spec) => {
      if (!(spec.from >= 0 && spec.from < 1) || !(spec.length > 0)) throw new Error(`tunnel ${JSON.stringify(spec)}: from must be in [0, 1), length > 0`)
      const fromS = distanceAtT(table, spec.from)
      const toS = fromS + spec.length
      if (fromS < dims.portalDepth || toS + dims.portalDepth > table.length) {
        throw new Error(`tunnel at ${spec.from} runs over the track's seam`)
      }
      return { fromS, toS, from: sampleAtOrAfter(table, fromS), to: sampleAtOrAfter(table, toS) - 1, reach }
    })
    .sort((a, b) => a.fromS - b.fromS)
  for (let i = 1; i < spans.length; i++) {
    if (spans[i].fromS < spans[i - 1].toS + 2 * dims.portalDepth) throw new Error('tunnels overlap')
  }
  return spans
}

/** `table` with its tunnels on it, or `table` itself when there are none (a level without set-pieces is unchanged). */
export function withTunnels(table: ArcTable, specs: readonly TunnelSpec[] | undefined, trackScale: number): ArcTable {
  if (!specs?.length) return table
  return { ...table, tunnels: tunnelSpans(table, specs, trackScale) }
}
/** Ribs' centres along a span: evenly spaced, none closer than half a spacing to either end. */
export function ribCentres(span: TunnelSpan, dims: TunnelDims): number[] {
  const n = Math.max(1, Math.round((span.toS - span.fromS) / dims.ribSpacing))
  const step = (span.toS - span.fromS) / n
  const out: number[] = []
  for (let k = 0; k < n; k++) out.push(span.fromS + step * (k + 0.5))
  return out
}
