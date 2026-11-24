import type { DarkSectionSpec, TunnelSpec } from '@/types/level'
import { type ArcTable, distanceAtT, indexAtT } from './arcLength'

/**
 * Track set-pieces (#332): tunnels, stretches where the track dives through a lit tube. A tunnel is data on
 * `TrackParams.tunnels`; this module places it on the arc table (`withTunnels`, which `trackClearance.ts`, the
 * camera and the e2e hook read back off the table). Pure: no three; `tunnelGeometry.ts` builds the mesh.
 */

/** Bus event as the car enters or leaves a tunnel: `(kind: 'enter' | 'exit', tunnel: number)`, the index in `ArcTable.tunnels`. */
export const TRACK_TUNNEL_EVENT = 'track:tunnel'

/** A stretch of track a set-piece is built over: `trackClearance.ts` keeps props further than `reach` (XZ) from its samples. */
export interface ClearanceSpan {
  /** First and last arc-table sample inside it. */
  from: number
  to: number
  /** How far from the centreline (XZ) the set-piece reaches. */
  reach: number
  /** A glass tube (`TunnelSpec.glass`): drawn see-through, and Ocean splashes as the car dives into it. */
  glass?: boolean
}

/** A tunnel's place on the track; its `reach` is the tube's and its portals'. */
export interface TunnelSpan extends ClearanceSpan {
  /** Arc distance of its entry and exit. */
  fromS: number
  toS: number
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

/** Each spec placed on the table, in ride order; throws on a tunnel that crosses the seam, overlaps another, has no portal room or another pass through it. */
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
      return { fromS, toS, from: sampleAtOrAfter(table, fromS), to: sampleAtOrAfter(table, toS) - 1, reach, ...(spec.glass ? { glass: true } : {}) }
    })
    .sort((a, b) => a.fromS - b.fromS)
  for (let i = 1; i < spans.length; i++) {
    if (spans[i].fromS < spans[i - 1].toS + 2 * dims.portalDepth) throw new Error('tunnels overlap')
  }
  for (const span of spans) {
    const pass = otherPassInTube(table, span, dims.centreUp)
    if (pass >= 0) throw new Error(`tunnel at ${span.fromS.toFixed(0)}: the track at ${pass.toFixed(0)} passes within its reach`)
  }
  return spans
}

/** Arc distance of a sample more than `reach` along the track from the span that comes within `reach` of its tube's centre, or -1. */
export function otherPassInTube(table: ArcTable, span: TunnelSpan, centreUp: number): number {
  const { reach } = span
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (let i = span.from; i <= span.to; i++) {
    minX = Math.min(minX, table.x[i])
    maxX = Math.max(maxX, table.x[i])
    minY = Math.min(minY, table.y[i] + centreUp)
    maxY = Math.max(maxY, table.y[i] + centreUp)
    minZ = Math.min(minZ, table.z[i])
    maxZ = Math.max(maxZ, table.z[i])
  }
  const r2 = reach * reach
  for (let j = 0; j < table.count; j++) {
    const x = table.x[j]
    const y = table.y[j]
    const z = table.z[j]
    if (x < minX - reach || x > maxX + reach || y < minY - reach || y > maxY + reach || z < minZ - reach || z > maxZ + reach) continue
    const s = table.s[j]
    const along = s < span.fromS ? Math.min(span.fromS - s, s + table.length - span.toS) : s > span.toS ? Math.min(s - span.toS, span.fromS + table.length - s) : 0
    if (along <= reach) continue
    for (let i = span.from; i <= span.to; i++) {
      const dx = x - table.x[i]
      const dy = y - table.y[i] - centreUp
      const dz = z - table.z[i]
      if (dx * dx + dy * dy + dz * dz < r2) return s
    }
  }
  return -1
}

/** `table` with its tunnels on it, or `table` itself when there are none (a level without set-pieces is unchanged). */
export function withTunnels(table: ArcTable, specs: readonly TunnelSpec[] | undefined, trackScale: number): ArcTable {
  if (!specs?.length) return table
  return { ...table, tunnels: tunnelSpans(table, specs, trackScale) }
}
/** `table` with a clearance over each dark section that has a `reach` (level 4's ice cave, #911), or `table` itself when none has. */
export function withDarkSections(table: ArcTable, sections: readonly DarkSectionSpec[] | undefined): ArcTable {
  const clearances = (sections ?? []).flatMap((d) => (d.reach ? [{ from: indexAtT(table, d.from), to: indexAtT(table, d.to), reach: d.reach }] : []))
  return clearances.length ? { ...table, clearances } : table
}

/** Ribs' centres along a span: evenly spaced, none closer than half a spacing to either end. */
export function ribCentres(span: TunnelSpan, dims: TunnelDims): number[] {
  const n = Math.max(1, Math.round((span.toS - span.fromS) / dims.ribSpacing))
  const step = (span.toS - span.fromS) / n
  const out: number[] = []
  for (let k = 0; k < n; k++) out.push(span.fromS + step * (k + 0.5))
  return out
}
