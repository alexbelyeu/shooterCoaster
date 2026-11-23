/**
 * What a rider can actually shoot (#925): the pacing gate and the ride review count a target only when it is inside the
 * view, big enough to read (`MIN_ENEMY_PX`) and not hidden behind the world. Counting every live enemy whose centre
 * projects into the viewport passed the gym's ride with stretches where every enemy was behind a wall, across the hall
 * as a speck, or under the floor (Alex's playtest, 23 Nov).
 *
 * Test tooling only (`?e2e=1`): it walks the scene and raycasts, so nothing in the game's frame loop calls it.
 */
import * as THREE from 'three'
import { MIN_ENEMY_PX, projectedPx } from '@/entities/enemies/enemyReadability'

/** One live target to judge: its centre, the world size it reads at, and the objects that draw it (left out as occluders). */
export interface SightTarget {
  id: string
  position: THREE.Vector3
  /** World units across: an enemy's silhouette (`ENEMY_SILHOUETTE`), a weak point's hit diameter. */
  size: number
  /** Its hit radius: a wall nearer the camera than the centre minus this hides it. */
  radius: number
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
    if (occludes(o, camera)) out.push(o as THREE.Mesh)
    for (const c of o.children) walk(c)
  }
  walk(scene)
  return out
}

/** Whether a target is shootable from `camera`, and if not, why. */
export function judgeTarget(
  t: SightTarget,
  camera: THREE.Camera,
  viewportHeight: number,
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
  if (projectedPx(t.size, distance, viewportHeight, fov) < MIN_ENEMY_PX) return 'tiny'
  _ray.set(_cam, ahead.divideScalar(distance))
  _ray.near = 0
  _ray.far = Math.max(0, distance - t.radius)
  for (const o of occluders) {
    _hits.length = 0
    o.raycast(_ray, _hits)
    if (_hits.some((h) => h.distance <= _ray.far)) return 'occluded'
  }
  return 'shootable'
}

export function countSight(
  targets: readonly SightTarget[],
  camera: THREE.Camera,
  viewportHeight: number,
  occluders: readonly THREE.Mesh[],
): SightCounts {
  const out: SightCounts = { shootable: 0, occluded: 0, tiny: 0, ids: [] }
  for (const t of targets) {
    const v = judgeTarget(t, camera, viewportHeight, occluders)
    if (v === 'shootable') {
      out.shootable++
      out.ids.push(t.id)
    } else if (v === 'occluded') out.occluded++
    else if (v === 'tiny') out.tiny++
  }
  return out
}
