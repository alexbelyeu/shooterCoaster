import * as THREE from 'three'

/**
 * Baked geometry for the Arctic ice props. Heights are baked into the vertices
 * (never scaled per axis); instances only get a uniform scale + yaw.
 */

interface Shard {
  height: number
  radius: number
  /** Lean away from the cluster centre (radians). */
  tilt: number
  /** Direction of the lean / offset (radians). */
  dir: number
  /** Horizontal offset of the base from the cluster centre. */
  offset: number
}

/** Hex prism with a pointed tip, base `bury` units below y = 0, appended as flat triangles. */
function pushShard(out: number[], s: Shard, bury: number) {
  const tipLen = s.radius * 1.6
  const y0 = -bury
  const y1 = s.height - tipLen
  const ring: THREE.Vector3[][] = [[], []]
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const x = Math.cos(a) * s.radius
    const z = Math.sin(a) * s.radius
    ring[0].push(new THREE.Vector3(x, y0, z))
    ring[1].push(new THREE.Vector3(x, y1, z))
  }
  const tip = new THREE.Vector3(0, s.height, 0)
  const m = new THREE.Matrix4()
    .makeTranslation(Math.cos(s.dir) * s.offset, 0, Math.sin(s.dir) * s.offset)
    .multiply(new THREE.Matrix4().makeRotationY(-s.dir))
    .multiply(new THREE.Matrix4().makeRotationZ(-s.tilt))
  for (const v of [...ring[0], ...ring[1], tip]) v.applyMatrix4(m)

  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
  }
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6
    tri(ring[0][i], ring[1][i], ring[0][j])
    tri(ring[0][j], ring[1][i], ring[1][j])
    tri(ring[1][i], tip, ring[1][j])
  }
}

function buildCluster(shards: Shard[], bury: number): THREE.BufferGeometry {
  const pos: number[] = []
  for (const s of shards) pushShard(pos, s, bury)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.computeVertexNormals() // non-indexed → flat facet normals
  geo.computeBoundingSphere()
  return geo
}

/** Footprint radius of the clusters at scale 1 (for grounding). */
export const CRYSTAL_FOOTPRINT = 10

/** Height of the tallest shard of each cluster at scale 1. */
export const SPIRE_HEIGHT = 60
export const SPLAY_HEIGHT = 24

/** Tall spire: one big central crystal with four leaning satellites. */
export function createSpireClusterGeometry(): THREE.BufferGeometry {
  return buildCluster(
    [
      { height: SPIRE_HEIGHT, radius: 6, tilt: 0.06, dir: 0.4, offset: 0 },
      { height: 38, radius: 4.5, tilt: 0.42, dir: 0.9, offset: 5 },
      { height: 30, radius: 4, tilt: 0.5, dir: 2.6, offset: 5 },
      { height: 26, radius: 3.5, tilt: 0.38, dir: 4.1, offset: 5.5 },
      { height: 20, radius: 3, tilt: 0.62, dir: 5.3, offset: 6 },
    ],
    6,
  )
}

/** Low splay: six short crystals fanning out. */
export function createSplayClusterGeometry(): THREE.BufferGeometry {
  return buildCluster(
    [
      { height: SPLAY_HEIGHT, radius: 3.6, tilt: 0.15, dir: 0, offset: 0 },
      { height: 20, radius: 3.2, tilt: 0.55, dir: 0.5, offset: 4 },
      { height: 17, radius: 3, tilt: 0.7, dir: 1.6, offset: 4.5 },
      { height: 22, radius: 3.4, tilt: 0.45, dir: 2.8, offset: 4 },
      { height: 15, radius: 2.6, tilt: 0.75, dir: 3.9, offset: 5 },
      { height: 18, radius: 3, tilt: 0.6, dir: 5.1, offset: 4.5 },
    ],
    4,
  )
}

/** Half-length of a snow drift along its long (x) axis, and its crest height, at scale 1. */
export const DRIFT_HALF_LENGTH = 2.6
export const DRIFT_HEIGHT = 0.45

/**
 * Wind-swept snow drift: a low flattened half-ellipsoid, long along x, with
 * its crest sheared downwind (+x) so one face is gentle and the other steep.
 */
export function createDriftGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) * DRIFT_HEIGHT
    pos.setXYZ(i, pos.getX(i) * DRIFT_HALF_LENGTH + y * 1.1, y - 0.12, pos.getZ(i) * 1.1)
  }
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}
