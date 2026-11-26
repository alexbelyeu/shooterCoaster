/**
 * What a rider can actually shoot (#925): the pacing gate and the ride review count a target only when it is inside the
 * view, big enough to read (`MIN_ENEMY_PX`) and not hidden behind the world. Counting every live enemy whose centre
 * projects into the viewport passed the gym's ride with stretches where every enemy was behind a wall, across the hall
 * as a speck, or under the floor (Alex's playtest, 23 Nov).
 *
 * Test tooling only (`?e2e=1`): it walks the scene and raycasts, so nothing in the game's frame loop calls it.
 */
import * as THREE from 'three'
import { MIN_ENEMY_PX, REFERENCE_VIEWPORT_H, projectedPx } from '@/entities/enemies/enemyReadability'

/** One live target to judge: its centre, the world size it reads at, and the objects that draw it (left out as occluders). */
export interface SightTarget {
  id: string
  position: THREE.Vector3
  /** World units across: an enemy's silhouette (`ENEMY_SILHOUETTE`), a weak point's hit diameter. */
  size: number
  /** Its hit radius: a wall nearer the camera than the centre minus this hides it. */
  radius: number
  /**
   * The middle of what draws it (`drawnCentre`), when that is not `position`: a ground enemy stands its origin at its feet,
   * where a ridge of terrain hides the point while its body stands in plain view (level 5's golems, #937). It is in sight
   * when either line is clear.
   */
  body?: THREE.Vector3
}

export type SightVerdict = 'shootable' | 'offscreen' | 'tiny' | 'occluded'

export interface SightCounts {
  shootable: number
  /** In the viewport, readable, but behind the world. */
  occluded: number
  /** In the viewport and in sight, but under `MIN_ENEMY_PX`. */
  tiny: number
  /** The shootable targets' ids. */
  ids: string[]
}

const _ray = new THREE.Raycaster()
const _cam = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _ndc = new THREE.Vector3()
const _hits: THREE.Intersection[] = []

/** A material that hides what is behind it: drawn, writing depth, not see-through. */
function opaque(m: THREE.Material): boolean {
  return m.visible && m.depthWrite && m.colorWrite && (!m.transparent || m.opacity >= 0.9) && !m.alphaTest
}

function occludes(o: THREE.Object3D, camera: THREE.Camera): boolean {
  if (!(o instanceof THREE.Mesh) || !o.layers.test(camera.layers)) return false
  const m = o.material as THREE.Material | THREE.Material[]
  return Array.isArray(m) ? m.some(opaque) : opaque(m)
}

/**
 * The scene's visible opaque meshes, skipping `skip`'s subtrees (the targets themselves, the boss's body) and anything
 * hidden or hung on the camera (the weapon).
 */
export function collectOccluders(scene: THREE.Object3D, camera: THREE.Camera, skip: ReadonlySet<THREE.Object3D>): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  const walk = (o: THREE.Object3D) => {
    if (!o.visible || skip.has(o) || o === camera) return
    if (occludes(o, camera)) {
      // InstancedMesh.raycast culls by a bounding sphere it computes once: a prop whose instances moved since would be missed.
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).boundingSphere = null
      out.push(o as THREE.Mesh)
    }
    for (const c of o.children) walk(c)
  }
  walk(scene)
  return out
}

/** Whether a target is shootable from `camera`, and if not, why. */
export function judgeTarget(
  t: SightTarget,
  camera: THREE.Camera,
  occluders: readonly THREE.Mesh[],
): SightVerdict {
  camera.getWorldPosition(_cam)
  _ndc.copy(t.position).project(camera)
  if (_ndc.z > 1 || Math.abs(_ndc.x) > 1 || Math.abs(_ndc.y) > 1) return 'offscreen'
  camera.getWorldDirection(_dir)
  const ahead = _ndc.copy(t.position).sub(_cam)
  if (ahead.dot(_dir) <= 0) return 'offscreen'
  const distance = ahead.length()
  const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 80
  // `MIN_ENEMY_PX` is px of a 720 px tall view: the same share of any viewport.
  if (projectedPx(t.size, distance, REFERENCE_VIEWPORT_H, fov) < MIN_ENEMY_PX) return 'tiny'
  if (clearLine(t.position, t.radius, occluders)) return 'shootable'
  return t.body && clearLine(t.body, t.radius, occluders) ? 'shootable' : 'occluded'
}

/** No occluder between the camera (`_cam`) and `point`, short of `radius` before it. */
function clearLine(point: THREE.Vector3, radius: number, occluders: readonly THREE.Mesh[]): boolean {
  _dir.copy(point).sub(_cam)
  const distance = _dir.length()
  _ray.set(_cam, _dir.divideScalar(distance))
  _ray.near = 0
  _ray.far = Math.max(0, distance - radius)
  for (const o of occluders) {
    _hits.length = 0
    o.raycast(_ray, _hits)
    if (_hits.some((h) => h.distance <= _ray.far)) return false
  }
  return true
}

const _box = new THREE.Box3()
const _meshBox = new THREE.Box3()

/** The centre of the world box round `object`'s visible meshes (its matrices as last rendered); null when none draws. */
export function drawnCentre(object: THREE.Object3D, out: THREE.Vector3): THREE.Vector3 | null {
  _box.makeEmpty()
  object.traverseVisible((o) => {
    const geometry = (o as THREE.Mesh).geometry
    if (!(o instanceof THREE.Mesh) || !geometry) return
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    _box.union(_meshBox.copy(geometry.boundingBox!).applyMatrix4(o.matrixWorld))
  })
  return _box.isEmpty() ? null : _box.getCenter(out)
}

export function countSight(
  targets: readonly SightTarget[],
  camera: THREE.Camera,
  occluders: readonly THREE.Mesh[],
): SightCounts {
  const out: SightCounts = { shootable: 0, occluded: 0, tiny: 0, ids: [] }
  for (const t of targets) {
    const v = judgeTarget(t, camera, occluders)
    if (v === 'shootable') {
      out.shootable++
      out.ids.push(t.id)
    } else if (v === 'occluded') out.occluded++
    else if (v === 'tiny') out.tiny++
  }
  return out
}

/**
 * Bunching (#1058): the most points (screen px) inside one aim-assist circle of `radius` centred on one of them, the
 * targets a single sweep of the blaster takes. A cluster parked in front of the camera meets the pacing gate cheaply and
 * makes the run easy; this is the number that says so.
 */
export function largestCluster(points: readonly { x: number; y: number }[], radius: number): number {
  const r2 = radius * radius
  let best = 0
  for (const p of points) {
    let n = 0
    for (const q of points) if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 <= r2) n++
    best = Math.max(best, n)
  }
  return best
}
