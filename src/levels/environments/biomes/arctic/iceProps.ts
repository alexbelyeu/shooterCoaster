import * as THREE from 'three'

/** Arctic ice props, heights baked in: instances only get a uniform scale + yaw. */

interface Shard {
  height: number
  radius: number
  /** Lean (radians) away from the cluster centre, towards `dir`. */
  tilt: number
  dir: number
  offset: number
}

/** Pointed hex prism, base `bury` units below y = 0 (no cap: it is always underground). */
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
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

export const CRYSTAL_FOOTPRINT = 10

export const SPIRE_HEIGHT = 60
export const SPLAY_HEIGHT = 24

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

export const DRIFT_HALF_LENGTH = 2.6
export const DRIFT_HEIGHT = 0.45

/** Low half-ellipsoid, long along x, crest sheared downwind (+x) like a wind-swept drift. */
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
