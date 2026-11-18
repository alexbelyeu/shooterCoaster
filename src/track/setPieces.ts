import * as THREE from 'three'
import type { TunnelSpec } from '@/types/level'
import type { HeightFunction } from '@/utils/terrainNoise'
import type { ShadowCaster } from '@/levels/environments/shared/contactShadows'
import type { TrackCurve } from './curves/TrackCurve'
import { type ArcTable, distanceAtT, tAtDistance } from './arcLength'
import { trackFrame } from './trackGeometry'

/**
 * Track set-pieces (#332): tunnels, stretches where the track dives through a lit tube. A tunnel is data on
 * `TrackParams.tunnels`; this module places it on the arc table (`withTunnels`, which `trackClearance.ts`, the
 * camera and the e2e hook read back off the table) and builds every tunnel of a level as one merged mesh: a dark
 * inner wall, light rings on ribs that strobe past, two strip lights along the sides, an outer shell and a portal
 * framed in bulbs at each end. The darkness is the geometry's: fog and exposure stay the level's own.
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

/** Sides of the tube's cross-section. */
const SIDES = 20
/** The ribs' light covers the wall but the floor under the track: ±130° from straight up. */
const RIB_ARC = (130 / 180) * Math.PI
/** Strip lights run along the wall at ±66° from straight up, each this wide (radians). */
const STRIP_ANGLE = (66 / 180) * Math.PI
const STRIP_HALF_WIDTH = 0.03
/** Bulbs round each portal's face. */
const PORTAL_BULBS = 28
/** Emissive strengths (× the light colour): past 1 so Bloom picks them up. */
const RIB_GLOW = 1.5
const STRIP_GLOW = 1.1
const BULB_GLOW = 3
/** Light the ribs spill on the wall round them, and how far along it (× `ribSpacing`). */
const SPILL_GLOW = 0.06
const SPILL_REACH = 0.18

function sampleAtOrAfter(table: ArcTable, dist: number): number {
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

export interface TunnelColours {
  /** The shell's outside. */
  shell: THREE.Color
  /** The inner wall: near black, so the tube is dark whatever lights the level. */
  inner: THREE.Color
  /** Portal frames. */
  frame: THREE.Color
  /** The ribs' faces: dark steel. */
  rib: THREE.Color
  /** Light rings, strips and bulbs (emissive). */
  light: THREE.Color
}

/** A level's tunnel colours from its track colours (0–1 sRGB): the shell from `color1`, frame and lights from `color2`. */
export function tunnelColours(color1: readonly number[], color2: readonly number[]): TunnelColours {
  const c1 = new THREE.Color(color1[0], color1[1], color1[2])
  const c2 = new THREE.Color(color2[0], color2[1], color2[2])
  return {
    shell: c1.clone().multiplyScalar(0.55),
    inner: new THREE.Color(0.018, 0.017, 0.022),
    frame: c2.clone().multiplyScalar(0.55),
    rib: new THREE.Color(0.08, 0.08, 0.09),
    light: c2.clone().lerp(new THREE.Color(1, 1, 1), 0.7),
  }
}

interface Frame {
  /** The tube's centre. */
  c: THREE.Vector3
  f: THREE.Vector3
  r: THREE.Vector3
  u: THREE.Vector3
}

/** Collects non-indexed triangles, each wound to face the way its vertex normals do. */
class MeshBuilder {
  positions: number[] = []
  normals: number[] = []
  colours: number[] = []
  emissive: number[] = []
  private readonly e1 = new THREE.Vector3()
  private readonly e2 = new THREE.Vector3()
  private readonly want = new THREE.Vector3()

  /** Quad a-b-c-d (in order round its edge) with a normal per corner, one colour, an emissive per corner. */
  quad(p: THREE.Vector3[], n: THREE.Vector3[], colour: THREE.Color, emissive: THREE.Color[]) {
    this.tri(p, n, colour, emissive, 0, 1, 2)
    this.tri(p, n, colour, emissive, 0, 2, 3)
  }

  private tri(p: THREE.Vector3[], n: THREE.Vector3[], colour: THREE.Color, emissive: THREE.Color[], a: number, b: number, c: number) {
    this.e1.subVectors(p[b], p[a])
    this.e2.subVectors(p[c], p[a])
    this.want.copy(n[a]).add(n[b]).add(n[c])
    const order = this.e1.cross(this.e2).dot(this.want) >= 0 ? [a, b, c] : [a, c, b]
    for (const i of order) {
      this.positions.push(p[i].x, p[i].y, p[i].z)
      this.normals.push(n[i].x, n[i].y, n[i].z)
      this.colours.push(colour.r, colour.g, colour.b)
      this.emissive.push(emissive[i].r, emissive[i].g, emissive[i].b)
    }
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colours, 3))
    geometry.setAttribute('aEmissive', new THREE.Float32BufferAttribute(this.emissive, 3))
    geometry.computeBoundingSphere()
    return geometry
  }
}

/** Point at `angle` from straight up (towards `right`) and `radius` round the frame's centre; `normal` gets the outward radial. */
function onRing(fr: Frame, angle: number, radius: number, normal?: THREE.Vector3): THREE.Vector3 {
  const dir = fr.r.clone().multiplyScalar(Math.sin(angle)).addScaledVector(fr.u, Math.cos(angle))
  normal?.copy(dir)
  return fr.c.clone().addScaledVector(dir, radius)
}

/** Ribs' centres along a span: evenly spaced, none closer than half a spacing to either end. */
export function ribCentres(span: TunnelSpan, dims: TunnelDims): number[] {
  const n = Math.max(1, Math.round((span.toS - span.fromS) / dims.ribSpacing))
  const step = (span.toS - span.fromS) / n
  const out: number[] = []
  for (let k = 0; k < n; k++) out.push(span.fromS + step * (k + 0.5))
  return out
}

/** Every tunnel on `table` as one geometry (attributes position, normal, color, aEmissive). Caller disposes. */
export function buildTunnelGeometry(curve: TrackCurve, table: ArcTable, dims: TunnelDims, colours: TunnelColours): THREE.BufferGeometry {
  const mesh = new MeshBuilder()
  const point = new THREE.Vector3()
  const prevRight = new THREE.Vector3(1, 0, 0)
  const frameAt = (dist: number): Frame => {
    const fr: Frame = { c: new THREE.Vector3(), f: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3() }
    trackFrame(curve, tAtDistance(table, dist), point, fr.f, fr.r, fr.u, prevRight)
    prevRight.copy(fr.r)
    fr.c.copy(point).addScaledVector(fr.u, dims.centreUp)
    return fr
  }
  const black = new THREE.Color(0, 0, 0)
  const glow = (k: number) => colours.light.clone().multiplyScalar(k)
  const blacks = [black, black, black, black]
  const angleOf = (j: number) => (j / SIDES) * Math.PI * 2 - Math.PI

  for (const span of table.tunnels ?? []) {
    const ribs = ribCentres(span, dims)
    const spillAt = (dist: number) => {
      let near = Infinity
      for (const c of ribs) near = Math.min(near, Math.abs(dist - c))
      const x = near / (dims.ribSpacing * SPILL_REACH)
      return glow(SPILL_GLOW * Math.exp(-x * x))
    }

    // Inner wall and strip lights, ring by ring.
    const rings = Math.max(2, Math.ceil((span.toS - span.fromS) / dims.ringStep))
    let prev = frameAt(span.fromS)
    let prevSpill = spillAt(span.fromS)
    for (let k = 1; k <= rings; k++) {
      const d = span.fromS + ((span.toS - span.fromS) * k) / rings
      const next = frameAt(d)
      const spill = spillAt(d)
      for (let j = 0; j < SIDES; j++) {
        const a0 = angleOf(j)
        const a1 = angleOf(j + 1)
        const n = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
        const p = [onRing(prev, a0, dims.radius, n[0]), onRing(prev, a1, dims.radius, n[1]), onRing(next, a1, dims.radius, n[2]), onRing(next, a0, dims.radius, n[3])]
        for (const v of n) v.negate()
        mesh.quad(p, n, colours.inner, [prevSpill, prevSpill, spill, spill])
      }
      for (const side of [-1, 1]) {
        const a0 = side * STRIP_ANGLE - STRIP_HALF_WIDTH
        const a1 = side * STRIP_ANGLE + STRIP_HALF_WIDTH
        const r = dims.radius - 0.1 * dims.wall
        const n = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
        const p = [onRing(prev, a0, r, n[0]), onRing(prev, a1, r, n[1]), onRing(next, a1, r, n[2]), onRing(next, a0, r, n[3])]
        for (const v of n) v.negate()
        const e = glow(STRIP_GLOW)
        mesh.quad(p, n, colours.light, [e, e, e, e])
      }
      prev = next
      prevSpill = spill
    }

    // Ribs: a lit band standing in from the wall, its face towards the rider in the frame colour.
    const ribGlow = glow(RIB_GLOW)
    const ribRadius = dims.radius - dims.ribDepth
    const ribSides = Math.round((RIB_ARC / Math.PI) * (SIDES / 2))
    for (const c of ribs) {
      const a = frameAt(c - dims.ribLength / 2)
      const b = frameAt(c + dims.ribLength / 2)
      for (let j = -ribSides; j < ribSides; j++) {
        const a0 = (j / ribSides) * RIB_ARC
        const a1 = ((j + 1) / ribSides) * RIB_ARC
        const n = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
        const p = [onRing(a, a0, ribRadius, n[0]), onRing(a, a1, ribRadius, n[1]), onRing(b, a1, ribRadius, n[2]), onRing(b, a0, ribRadius, n[3])]
        for (const v of n) v.negate()
        mesh.quad(p, n, colours.light, [ribGlow, ribGlow, ribGlow, ribGlow])
        const back = a.f.clone().negate()
        mesh.quad(
          [onRing(a, a0, dims.radius), onRing(a, a1, dims.radius), onRing(a, a1, ribRadius), onRing(a, a0, ribRadius)],
          [back, back, back, back], colours.rib, blacks,
        )
      }
    }

    // Outer shell, coarser: nothing lights it but the level.
    const shellRings = Math.max(2, Math.ceil((span.toS - span.fromS) / (dims.ribSpacing / 2)))
    const outer = dims.radius + dims.wall
    prev = frameAt(span.fromS)
    for (let k = 1; k <= shellRings; k++) {
      const next = frameAt(span.fromS + ((span.toS - span.fromS) * k) / shellRings)
      for (let j = 0; j < SIDES; j++) {
        const n = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
        const p = [onRing(prev, angleOf(j), outer, n[0]), onRing(prev, angleOf(j + 1), outer, n[1]), onRing(next, angleOf(j + 1), outer, n[2]), onRing(next, angleOf(j), outer, n[3])]
        mesh.quad(p, n, colours.shell, blacks)
      }
      prev = next
    }

    // Portals: a frame round each end, its outward face ringed with bulbs.
    for (const end of [-1, 1]) {
      const at = end < 0 ? span.fromS : span.toS
      const face = frameAt(at + end * dims.portalDepth)
      const mouth = frameAt(at)
      const out = face.f.clone().multiplyScalar(end)
      const rim = outer + dims.portalWidth
      for (let j = 0; j < SIDES; j++) {
        const a0 = angleOf(j)
        const a1 = angleOf(j + 1)
        // Outward face, from the tube's inner radius out to the frame's rim.
        mesh.quad([onRing(face, a0, dims.radius), onRing(face, a1, dims.radius), onRing(face, a1, rim), onRing(face, a0, rim)], [out, out, out, out], colours.frame, blacks)
        // The mouth's lining, from the face back to where the tunnel's wall starts.
        const n = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
        const p = [onRing(face, a0, dims.radius, n[0]), onRing(face, a1, dims.radius, n[1]), onRing(mouth, a1, dims.radius, n[2]), onRing(mouth, a0, dims.radius, n[3])]
        for (const v of n) v.negate()
        mesh.quad(p, n, colours.frame, blacks)
        // Rim and back face.
        const r = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
        mesh.quad([onRing(face, a0, rim, r[0]), onRing(face, a1, rim, r[1]), onRing(mouth, a1, rim, r[2]), onRing(mouth, a0, rim, r[3])], r, colours.frame, blacks)
        const inward = out.clone().negate()
        mesh.quad([onRing(mouth, a0, outer), onRing(mouth, a1, outer), onRing(mouth, a1, rim), onRing(mouth, a0, rim)], [inward, inward, inward, inward], colours.frame, blacks)
      }
      const bulb = glow(BULB_GLOW)
      const lift = face.f.clone().multiplyScalar(end * 0.05 * dims.wall)
      const half = (0.3 * Math.PI) / PORTAL_BULBS
      const bulbIn = outer + dims.portalWidth * 0.3
      const bulbOut = outer + dims.portalWidth * 0.7
      for (let b = 0; b < PORTAL_BULBS; b++) {
        const a = (b / PORTAL_BULBS) * Math.PI * 2
        const p = [onRing(face, a - half, bulbIn), onRing(face, a + half, bulbIn), onRing(face, a + half, bulbOut), onRing(face, a - half, bulbOut)]
        for (const v of p) v.add(lift)
        mesh.quad(p, [out, out, out, out], colours.light, [bulb, bulb, bulb, bulb])
      }
    }
  }
  return mesh.build()
}

/** Contact shadows under the tunnels: the tube and its portals, fading out where they stand high over the ground. */
export function tunnelShadowCasters(table: ArcTable, dims: TunnelDims, groundFn: HeightFunction): ShadowCaster[] {
  const out: ShadowCaster[] = []
  const outer = dims.radius + dims.wall
  const push = (dist: number, halfX: number, halfZ: number) => {
    // `tunnelSpans` keeps every tunnel and its portals off the table's ends.
    const j = sampleAtOrAfter(table, dist)
    const x = table.x[j]
    const z = table.z[j]
    const bottom = table.y[j] + dims.centreUp - outer
    const height = bottom - groundFn(x, z)
    const strength = 0.6 * Math.min(1, Math.max(0, 1 - height / (3 * outer)))
    if (strength <= 0) return
    const yaw = Math.atan2(table.x[j + 1] - table.x[j - 1], table.z[j + 1] - table.z[j - 1])
    out.push({ x, z, halfX, halfZ, yaw, radius: halfX * 0.4, spread: halfX * 1.2, strength })
  }
  for (const span of table.tunnels ?? []) {
    const n = Math.max(1, Math.round((span.toS - span.fromS) / (2 * outer)))
    for (let k = 0; k < n; k++) push(span.fromS + ((k + 0.5) * (span.toS - span.fromS)) / n, outer, (span.toS - span.fromS) / n / 2)
    push(span.fromS - dims.portalDepth / 2, outer + dims.portalWidth, dims.portalDepth / 2 + dims.portalWidth * 0.3)
    push(span.toS + dims.portalDepth / 2, outer + dims.portalWidth, dims.portalDepth / 2 + dims.portalWidth * 0.3)
  }
  return out
}
