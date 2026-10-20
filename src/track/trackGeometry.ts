import * as THREE from 'three'
import type { TrackCurve } from './curves/TrackCurve'
import type { TrackDimensions } from './trackDimensions'
import { type ArcTable, tAtDistance } from './arcLength'

type RGB = [number, number, number]

/** Radial segments: running rails are thin (6 reads round); the spine is fat (8). */
const RAIL_SIDES = 6
const SPINE_SIDES = 8
/** Ties are capped so very long tracks (Volcanic ≈ 62k units) stay in the triangle budget. */
export const MAX_TIES = 1600

const WORLD_UP = new THREE.Vector3(0, 1, 0)

/**
 * Orthonormal track frame at t: forward = tangent, right is kept horizontal so
 * the rails never roll, up = forward × right. `prevRight` is reused when the
 * track is (near) vertical and right is undefined.
 */
export function trackFrame(
  curve: TrackCurve,
  t: number,
  point: THREE.Vector3,
  forward: THREE.Vector3,
  right: THREE.Vector3,
  up: THREE.Vector3,
  prevRight?: THREE.Vector3,
) {
  point.copy(curve.getPointAt(t))
  forward.copy(curve.getTangentAt(t))
  right.crossVectors(WORLD_UP, forward)
  if (right.lengthSq() < 1e-6) {
    if (prevRight) right.copy(prevRight)
    else right.set(1, 0, 0)
  }
  right.normalize()
  up.crossVectors(forward, right).normalize()
}

/**
 * Builds the running rails, spine and cross ties as one indexed, vertex-coloured
 * BufferGeometry. Rails/spine are smooth tubes sampled uniformly in t (same
 * tessellation as the original RollerCoaster.js port); ties are triangular
 * yokes (rail – rail – spine) spaced evenly by arc length.
 */
export function buildTrackGeometry(
  curve: TrackCurve,
  table: ArcTable,
  dims: TrackDimensions,
  segments: number,
  color1: RGB,
  color2: RGB,
): THREE.BufferGeometry {
  const ringCount = segments + 1
  const tieSpacing = Math.max(dims.tieSpacing, table.length / MAX_TIES)
  const tieCount = Math.floor(table.length / tieSpacing)

  const tubeVerts = ringCount * (RAIL_SIDES * 2 + SPINE_SIDES)
  const tieVerts = tieCount * 18
  const positions = new Float32Array((tubeVerts + tieVerts) * 3)
  const normals = new Float32Array((tubeVerts + tieVerts) * 3)
  const colors = new Float32Array((tubeVerts + tieVerts) * 3)
  const indices: number[] = []
  let v = 0

  const point = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3()
  const prevRight = new THREE.Vector3(1, 0, 0)
  const dir = new THREE.Vector3()
  const center = new THREE.Vector3()

  function pushVertex(p: THREE.Vector3, n: THREE.Vector3, c: RGB) {
    positions[v * 3] = p.x
    positions[v * 3 + 1] = p.y
    positions[v * 3 + 2] = p.z
    normals[v * 3] = n.x
    normals[v * 3 + 1] = n.y
    normals[v * 3 + 2] = n.z
    colors[v * 3] = c[0]
    colors[v * 3 + 1] = c[1]
    colors[v * 3 + 2] = c[2]
    v++
  }

  const ta = new THREE.Vector3()
  const tb = new THREE.Vector3()
  const tc = new THREE.Vector3()
  /** Push a triangle wound so its face normal agrees with `want` (front-face culling safe). */
  function pushTri(i0: number, i1: number, i2: number, want: THREE.Vector3) {
    ta.fromArray(positions, i0 * 3)
    tb.fromArray(positions, i1 * 3).sub(ta)
    tc.fromArray(positions, i2 * 3).sub(ta)
    if (tb.cross(tc).dot(want) >= 0) indices.push(i0, i1, i2)
    else indices.push(i0, i2, i1)
  }

  // --- Tubes: lay out all rings of tube A, then tube B, then the spine. ---
  const tubes: { ox: number; oy: number; r: number; sides: number; color: RGB }[] = [
    { ox: -dims.railGauge, oy: 0, r: dims.railRadius, sides: RAIL_SIDES, color: color1 },
    { ox: dims.railGauge, oy: 0, r: dims.railRadius, sides: RAIL_SIDES, color: color1 },
    { ox: 0, oy: dims.spineOffset, r: dims.spineRadius, sides: SPINE_SIDES, color: color2 },
  ]
  for (const tube of tubes) {
    const base = v
    prevRight.set(1, 0, 0)
    for (let i = 0; i < ringCount; i++) {
      trackFrame(curve, i / segments, point, forward, right, up, prevRight)
      prevRight.copy(right)
      center.copy(point).addScaledVector(right, tube.ox).addScaledVector(up, tube.oy)
      for (let j = 0; j < tube.sides; j++) {
        const a = (j / tube.sides) * Math.PI * 2
        dir.copy(right).multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a))
        pushVertex(point.copy(center).addScaledVector(dir, tube.r), dir, tube.color)
      }
    }
    for (let i = 0; i < segments; i++) {
      const r0 = base + i * tube.sides
      const r1 = r0 + tube.sides
      for (let j = 0; j < tube.sides; j++) {
        const j1 = (j + 1) % tube.sides
        // CCW seen from outside (frame is right-handed: right × up = forward).
        indices.push(r0 + j, r0 + j1, r1 + j, r0 + j1, r1 + j1, r1 + j)
      }
    }
  }

  // --- Ties: triangular yoke under both rails down to the spine. ---
  const corner = [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()]
  const yokeTop = -dims.railRadius * 0.6
  corner[0].set(-dims.railGauge, yokeTop)
  corner[1].set(dims.railGauge, yokeTop)
  corner[2].set(0, dims.spineOffset)
  const half = dims.tieThickness / 2
  const quad = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const n = new THREE.Vector3()
  const edge = new THREE.Vector3()

  const local = (c: THREE.Vector2, along: number, out: THREE.Vector3) =>
    out.copy(point).addScaledVector(right, c.x).addScaledVector(up, c.y).addScaledVector(forward, along)

  prevRight.set(1, 0, 0)
  for (let k = 0; k < tieCount; k++) {
    const t = tAtDistance(table, (k + 0.5) * tieSpacing)
    trackFrame(curve, t, point, forward, right, up, prevRight)
    prevRight.copy(right)

    // Front and back triangles.
    for (const side of [1, -1]) {
      const b = v
      n.copy(forward).multiplyScalar(side)
      for (let c = 0; c < 3; c++) pushVertex(local(corner[c], half * side, quad[0]), n, color2)
      pushTri(b, b + 1, b + 2, n)
    }
    // Three side quads.
    for (let c = 0; c < 3; c++) {
      const c0 = corner[c]
      const c1 = corner[(c + 1) % 3]
      local(c0, half, quad[0])
      local(c1, half, quad[1])
      local(c1, -half, quad[2])
      local(c0, -half, quad[3])
      // Outward normal: perpendicular to the edge in the cross-section plane.
      edge.copy(quad[1]).sub(quad[0])
      n.crossVectors(edge, forward).normalize()
      // Make sure it points away from the triangle's centroid (spine side check).
      const cx = (corner[0].x + corner[1].x + corner[2].x) / 3
      const cy = (corner[0].y + corner[1].y + corner[2].y) / 3
      const mx = (c0.x + c1.x) / 2 - cx
      const my = (c0.y + c1.y) / 2 - cy
      dir.copy(right).multiplyScalar(mx).addScaledVector(up, my)
      if (n.dot(dir) < 0) n.negate()
      const b = v
      for (let q = 0; q < 4; q++) pushVertex(quad[q], n, color2)
      pushTri(b, b + 1, b + 2, n)
      pushTri(b, b + 2, b + 3, n)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, v * 3), 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals.subarray(0, v * 3), 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors.subarray(0, v * 3), 3))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}
