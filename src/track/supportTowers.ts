import * as THREE from 'three'
import type { TrackCurve } from './curves/TrackCurve'
import type { HeightFunction } from '@/utils/terrainNoise'
import type { ShadowCaster } from '@/levels/environments/shared/contactShadows'
import type { TrackDimensions } from './trackDimensions'
import { type ArcTable, tAtDistance } from './arcLength'
import { trackFrame } from './trackGeometry'

/**
 * Lattice support towers for the coaster.
 *
 * A tower is four straight, splayed legs with horizontal struts and a zig-zag
 * (Warren) diagonal on every face, plus a cross-beam under the spine. Panels get
 * taller as the tower widens, like a real lattice mast, so even very tall towers
 * stay cheap. Geometry is built in tower-local space with the top at y = 0
 * growing down (-y), x across the track and z along it.
 *
 * Every tower of a given height bucket shares one geometry (InstancedMesh). A
 * bucket's geometry is the top H units of the same infinite tower, so a tower
 * that needs height h < H is simply sunk into the ground by H - h — no Y-scaling.
 */

/** Width increase per unit of depth (total, across both sides). */
const SPLAY = 0.09
/** Panel height as a fraction of the tower width at the panel's top. */
const PANEL_ASPECT = 1.35
/** Max distinct tower heights (one InstancedMesh each). */
export const HEIGHT_BUCKETS = 8
/** Towers are skipped where the track is closer than this to the ground. */
export const MIN_TOWER_HEIGHT = 5
/** How far below the lowest leg footing the tower geometry continues. */
const BURY = 3
/**
 * Triangle budget for all towers in a level. Long, high tracks (Volcanic: 62k
 * units long, up to 1200 high) widen the spacing until they fit.
 */
export const TOWER_TRI_BUDGET = 34000

export interface TowerDims {
  /** Tower width at the top (leg centre to leg centre). */
  topWidth: number
  legHalf: number
  braceRadius: number
  beamHalf: number
}

export function getTowerDims(dims: TrackDimensions): TowerDims {
  const s = dims.trackScale
  return {
    topWidth: dims.railGauge * 2.2,
    legHalf: 0.32 * s,
    braceRadius: 0.2 * s,
    beamHalf: 0.38 * s,
  }
}

export interface TowerInstance {
  x: number
  z: number
  /** World Y of the tower top (bottom of the cross-beam contact). */
  topY: number
  yaw: number
  /** Required height from top to the deepest footing + BURY. */
  height: number
  /**
   * The four leg footings: `y` is the visible (rendered) ground under the leg,
   * `bottom` is low enough to also be under `heightFn` there, `size` the pad width.
   */
  feet: { x: number; y: number; z: number; bottom: number; size: number }[]
  bucket: number
}

export interface TowerPlan {
  towers: TowerInstance[]
  bucketHeights: number[]
  spacing: number
  triangles: number
}

function widthAt(td: TowerDims, depth: number) {
  return td.topWidth + SPLAY * depth
}

/** Depths (from the top) of the horizontal struts for a tower `height` deep. */
function panelLevels(td: TowerDims, height: number): number[] {
  const levels: number[] = [td.beamHalf * 2]
  let d = levels[0]
  while (d < height) {
    d += PANEL_ASPECT * widthAt(td, d)
    levels.push(Math.min(d, height))
  }
  return levels
}

const TRIS_LEG = 8 // square prism, no caps
const TRIS_BRACE = 6 // triangular prism, no caps
const TRIS_BEAM = 12 // closed box

export function towerTriangles(td: TowerDims, height: number): number {
  const panels = panelLevels(td, height).length - 1
  return 4 * TRIS_LEG + TRIS_BEAM + panels * 8 * TRIS_BRACE
}

/* ------------------------------------------------------------------ */
/* Planning                                                            */
/* ------------------------------------------------------------------ */

/**
 * Places towers along the track by arc length, at `dims.towerSpacing` or wider
 * if the triangle budget demands it. A candidate is skipped where the track is
 * < MIN_TOWER_HEIGHT above ground, or where its lattice would intersect another
 * part of the track passing underneath.
 */
export function planTowers(
  curve: TrackCurve,
  table: ArcTable,
  dims: TrackDimensions,
  heightFn: HeightFunction,
  groundFn: HeightFunction = heightFn,
): TowerPlan {
  const td = getTowerDims(dims)
  let spacing = dims.towerSpacing
  let plan = planAtSpacing(curve, table, dims, td, heightFn, groundFn, spacing)
  for (let i = 0; i < 6 && plan.triangles > TOWER_TRI_BUDGET; i++) {
    spacing *= (plan.triangles / TOWER_TRI_BUDGET) * 1.04
    plan = planAtSpacing(curve, table, dims, td, heightFn, groundFn, spacing)
  }
  return plan
}

function planAtSpacing(
  curve: TrackCurve,
  table: ArcTable,
  dims: TrackDimensions,
  td: TowerDims,
  heightFn: HeightFunction,
  groundFn: HeightFunction,
  spacing: number,
): TowerPlan {
  const point = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3()
  const center = new THREE.Vector3()

  // Distance from the rail plane down to the bottom of the spine.
  const spineBottom = -dims.spineOffset + dims.spineRadius
  // How close other track may come to a tower's lattice (rails + ties).
  const clearance = dims.railGauge + dims.railRadius + 1.5 * dims.trackScale
  const halfTop = td.topWidth / 2

  const candidates: TowerInstance[] = []
  const count = Math.floor(table.length / spacing)
  for (let k = 0; k < count; k++) {
    const dist = (k + 0.5) * spacing
    const t = tAtDistance(table, dist)
    trackFrame(curve, t, point, forward, right, up)
    // Spine bottom, directly under the rail centreline.
    center.copy(point).addScaledVector(up, -spineBottom)
    const cx = center.x
    const cz = center.z

    // The top must clear the spine everywhere over the tower's footprint
    // (matters on steep sections).
    let topY = center.y
    for (let i = 0; i < table.count; i++) {
      const ds = Math.abs(table.s[i] - dist)
      if (ds > td.topWidth * 1.5) continue
      const dx = table.x[i] - cx
      const dz = table.z[i] - cz
      if (dx * dx + dz * dz > (halfTop + clearance) ** 2) continue
      topY = Math.min(topY, table.y[i] - spineBottom)
    }
    topY -= 0.05 * dims.trackScale

    const groundC = Math.max(heightFn(cx, cz), groundFn(cx, cz))
    if (topY - groundC < MIN_TOWER_HEIGHT) continue

    const horizLen = Math.hypot(forward.x, forward.z)
    if (horizLen < 0.2) continue // near-vertical track: no sensible tower
    const yaw = Math.atan2(forward.x, forward.z)
    const cosY = Math.cos(yaw)
    const sinY = Math.sin(yaw)

    // Leg footings: legs splay, so solve depth where each leg meets the ground.
    const feet: TowerInstance['feet'] = []
    let maxDepth = 0
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      let depth = topY - groundC
      let fx = cx
      let fz = cz
      let gy = groundC
      for (let it = 0; it < 4; it++) {
        const hw = widthAt(td, depth) / 2
        const lx = sx * hw
        const lz = sz * hw
        // local (x across, z along) -> world, rotated by yaw about +Y
        fx = cx + lx * cosY + lz * sinY
        fz = cz - lx * sinY + lz * cosY
        gy = groundFn(fx, fz)
        depth = topY - gy
      }
      const bottom = Math.min(gy, heightFn(fx, fz)) - 1
      maxDepth = Math.max(maxDepth, topY - bottom)
      feet.push({ x: fx, y: gy, z: fz, bottom, size: legHalfAt(td, depth) * 5 })
    }
    if (feet.some((f) => topY - f.y < MIN_TOWER_HEIGHT * 0.5)) continue

    const height = maxDepth + BURY
    if (piercesTrack(table, dist, cx, cz, topY, topY - maxDepth, td, clearance)) continue

    candidates.push({ x: cx, z: cz, topY, yaw, height, feet, bucket: 0 })
  }

  // Quantile buckets: sort by height, split into equal groups, bucket = group max.
  const sorted = [...candidates].sort((a, b) => a.height - b.height)
  const nb = Math.min(HEIGHT_BUCKETS, sorted.length)
  const bucketHeights: number[] = []
  for (let b = 0; b < nb; b++) {
    const end = Math.floor(((b + 1) * sorted.length) / nb)
    const start = Math.floor((b * sorted.length) / nb)
    for (let i = start; i < end; i++) sorted[i].bucket = b
    bucketHeights.push(sorted[end - 1].height)
  }
  let triangles = 0
  for (const c of candidates) triangles += towerTriangles(td, bucketHeights[c.bucket])

  return { towers: candidates, bucketHeights, spacing, triangles }
}

/** A dark pool under each footing pad, and a faint square under the whole lattice. */
export function towerShadowCasters(plan: TowerPlan): ShadowCaster[] {
  const out: ShadowCaster[] = []
  for (const t of plan.towers) {
    let reach = 0
    for (const f of t.feet) {
      out.push({ x: f.x, z: f.z, halfX: f.size / 2, halfZ: f.size / 2, yaw: t.yaw, radius: f.size / 4, spread: f.size * 2.5, strength: 0.7 })
      reach += Math.hypot(f.x - t.x, f.z - t.z)
    }
    // Feet sit on the corners: half-width = half-diagonal / √2.
    const half = reach / t.feet.length / Math.SQRT2
    out.push({ x: t.x, z: t.z, halfX: half, halfZ: half, yaw: t.yaw, radius: half * 0.3, spread: half * 0.5, strength: 0.3 })
  }
  return out
}

function legHalfAt(td: TowerDims, depth: number) {
  return td.legHalf * (1 + depth * 0.004)
}

/**
 * True if any part of the track other than the tower's own section passes
 * through the tower's (splayed) footprint between its top and the ground.
 */
function piercesTrack(
  table: ArcTable,
  dist: number,
  cx: number,
  cz: number,
  topY: number,
  bottomY: number,
  td: TowerDims,
  clearance: number,
): boolean {
  for (let i = 0; i < table.count; i++) {
    if (Math.abs(table.s[i] - dist) < td.topWidth * 1.5) continue
    const y = table.y[i]
    if (y > topY + clearance * 2 || y < bottomY - clearance) continue
    const depth = Math.max(0, topY - y)
    // Half-diagonal of the square tower at that depth (rotation-agnostic).
    const reach = (widthAt(td, depth) / 2) * Math.SQRT2 + clearance
    const dx = table.x[i] - cx
    const dz = table.z[i] - cz
    if (dx * dx + dz * dz < reach * reach) return true
  }
  return false
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

class PrismBuilder {
  positions: number[] = []
  normals: number[] = []
  private a = new THREE.Vector3()
  private b = new THREE.Vector3()
  private dir = new THREE.Vector3()
  private u = new THREE.Vector3()
  private w = new THREE.Vector3()
  private n = new THREE.Vector3()
  private ca: THREE.Vector3[] = []
  private cb: THREE.Vector3[] = []

  /**
   * Open-ended prism from A to B. `sides` 3 or 4; radius tapers rA -> rB.
   * `outward` orients the cross-section so a flat face (sides 3) or a corner
   * diagonal (sides 4) faces it.
   */
  prism(
    A: THREE.Vector3,
    B: THREE.Vector3,
    rA: number,
    rB: number,
    sides: number,
    outward: THREE.Vector3,
    phase = 0,
  ) {
    const { dir, u, w, n } = this
    dir.subVectors(B, A).normalize()
    u.copy(outward).addScaledVector(dir, -outward.dot(dir))
    if (u.lengthSq() < 1e-8) u.set(dir.y, -dir.x, 0)
    if (u.lengthSq() < 1e-8) u.set(0, dir.z, -dir.y)
    u.normalize()
    w.crossVectors(dir, u)
    while (this.ca.length < sides) {
      this.ca.push(new THREE.Vector3())
      this.cb.push(new THREE.Vector3())
    }
    for (let i = 0; i < sides; i++) {
      const ang = phase + (i / sides) * Math.PI * 2
      const c = Math.cos(ang)
      const s = Math.sin(ang)
      this.ca[i].copy(A).addScaledVector(u, c * rA).addScaledVector(w, s * rA)
      this.cb[i].copy(B).addScaledVector(u, c * rB).addScaledVector(w, s * rB)
    }
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides
      const mid = phase + ((i + 0.5) / sides) * Math.PI * 2
      n.copy(u).multiplyScalar(Math.cos(mid)).addScaledVector(w, Math.sin(mid)).normalize()
      this.quad(this.ca[i], this.ca[j], this.cb[j], this.cb[i], n)
    }
  }

  /** Axis-aligned closed box (tower-local), from min to max corner. */
  box(min: THREE.Vector3, max: THREE.Vector3) {
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    const [x0, y0, z0, x1, y1, z1] = [min.x, min.y, min.z, max.x, max.y, max.z]
    const faces: [THREE.Vector3[], THREE.Vector3][] = [
      [[v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1)], v(1, 0, 0)],
      [[v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0), v(x0, y0, z0)], v(-1, 0, 0)],
      [[v(x0, y1, z0), v(x0, y1, z1), v(x1, y1, z1), v(x1, y1, z0)], v(0, 1, 0)],
      [[v(x0, y0, z1), v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1)], v(0, -1, 0)],
      [[v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)], v(0, 0, 1)],
      [[v(x1, y0, z0), v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0)], v(0, 0, -1)],
    ]
    for (const [q, n] of faces) this.quad(q[0], q[1], q[2], q[3], n)
  }

  /** Quad as two triangles, wound so the face normal agrees with n. */
  private quad(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, n: THREE.Vector3) {
    this.a.subVectors(p1, p0)
    this.b.subVectors(p2, p0)
    const flip = this.a.cross(this.b).dot(n) < 0
    const tris = flip ? [p0, p2, p1, p0, p3, p2] : [p0, p1, p2, p0, p2, p3]
    for (const p of tris) {
      this.positions.push(p.x, p.y, p.z)
      this.normals.push(n.x, n.y, n.z)
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3))
    g.computeBoundingSphere()
    return g
  }
}

/** One lattice tower, top at y = 0, `height` deep. */
export function buildTowerGeometry(td: TowerDims, height: number): THREE.BufferGeometry {
  const pb = new PrismBuilder()
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]
  const legPos = (c: [number, number], depth: number, out: THREE.Vector3) => {
    const hw = widthAt(td, depth) / 2
    return out.set(c[0] * hw, -depth, c[1] * hw)
  }
  const A = new THREE.Vector3()
  const B = new THREE.Vector3()
  const out = new THREE.Vector3()

  // Legs: straight from top to bottom, slightly thicker at the base.
  for (const c of corners) {
    legPos(c, 0, A)
    legPos(c, height, B)
    out.set(c[0], 0, c[1])
    pb.prism(A, B, td.legHalf * Math.SQRT2, legHalfAt(td, height) * Math.SQRT2, 4, out, Math.PI / 4)
  }

  // Cross-beam under the spine, across the track (x), overhanging the legs.
  const bw = td.topWidth / 2 + td.legHalf * 2.5
  pb.box(
    new THREE.Vector3(-bw, -td.beamHalf * 2, -td.beamHalf),
    new THREE.Vector3(bw, 0, td.beamHalf),
  )

  // Panels: horizontal ring + one diagonal per face, alternating direction.
  const levels = panelLevels(td, height)
  const faceOut = [
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(-1, 0, 0),
  ]
  const P = new THREE.Vector3()
  const Q = new THREE.Vector3()
  for (let li = 1; li < levels.length; li++) {
    const d0 = levels[li - 1]
    const d1 = levels[li]
    const r = td.braceRadius * (1 + d1 * 0.003)
    for (let f = 0; f < 4; f++) {
      const c0 = corners[f]
      const c1 = corners[(f + 1) % 4]
      // Horizontal strut at the bottom of the panel.
      legPos(c0, d1, P)
      legPos(c1, d1, Q)
      pb.prism(P, Q, r, r, 3, faceOut[f])
      // Diagonal: alternate per panel and per face so adjacent faces meet at legs.
      const flip = (li + f) % 2 === 0
      legPos(flip ? c0 : c1, d0, P)
      legPos(flip ? c1 : c0, d1, Q)
      pb.prism(P, Q, r, r, 3, faceOut[f])
    }
  }
  return pb.build()
}

/**
 * Footing pad: unit box, top at y = 0, 1 deep. Instanced with scale
 * (width, depth, width) — a plain box, so non-uniform scale doesn't distort it.
 */
export function buildFootingGeometry(): THREE.BufferGeometry {
  const pb = new PrismBuilder()
  pb.box(new THREE.Vector3(-0.5, -1, -0.5), new THREE.Vector3(0.5, 0, 0.5))
  return pb.build()
}
