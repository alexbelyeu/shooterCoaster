import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { collectOccluders, countSight, drawnCentre, judgeTarget, largestCluster, type SightTarget } from './lineOfSight'

function setup() {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 5000)
  camera.position.set(0, 0, 0)
  camera.lookAt(0, 0, -1)
  camera.updateMatrixWorld(true)
  scene.add(camera)
  return { scene, camera }
}

const target = (z: number, size = 50): SightTarget => ({ id: `t${z}`, position: new THREE.Vector3(0, 0, z), size, radius: size / 2 })

function wall(scene: THREE.Scene, z: number, material: THREE.Material = new THREE.MeshBasicMaterial()) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(400, 400, 2), material)
  mesh.position.z = z
  scene.add(mesh)
  scene.updateMatrixWorld(true)
  return mesh
}

describe('lineOfSight', () => {
  it('counts a near enemy in open view as shootable', () => {
    const { scene, camera } = setup()
    expect(judgeTarget(target(-200), camera, collectOccluders(scene, camera, new Set()))).toBe('shootable')
  })

  it('a wall between the camera and the enemy hides it', () => {
    const { scene, camera } = setup()
    wall(scene, -100)
    expect(judgeTarget(target(-200), camera, collectOccluders(scene, camera, new Set()))).toBe('occluded')
  })

  it('a ground enemy whose feet a ridge hides is in sight when its body is', () => {
    const { scene, camera } = setup()
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(400, 20, 2), new THREE.MeshBasicMaterial())
    ridge.position.set(0, -25, -100)
    scene.add(ridge)
    scene.updateMatrixWorld(true)
    const feet: SightTarget = { id: 'golem', position: new THREE.Vector3(0, -50, -200), size: 50, radius: 10 }
    const occluders = collectOccluders(scene, camera, new Set())
    expect(judgeTarget(feet, camera, occluders)).toBe('occluded')
    expect(judgeTarget({ ...feet, body: new THREE.Vector3(0, 10, -200) }, camera, occluders)).toBe('shootable')
    wall(scene, -100)
    expect(judgeTarget({ ...feet, body: new THREE.Vector3(0, 10, -200) }, camera, collectOccluders(scene, camera, new Set()))).toBe('occluded')
  })

  it('the drawn centre is the middle of what is visible', () => {
    const group = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 100, 10))
    body.position.y = 50
    const hidden = new THREE.Mesh(new THREE.BoxGeometry(1000, 1000, 1000))
    hidden.visible = false
    group.add(body, hidden)
    group.position.set(5, 0, -20)
    group.updateMatrixWorld(true)
    expect(drawnCentre(group, new THREE.Vector3())?.toArray()).toEqual([5, 50, -20])
    expect(drawnCentre(new THREE.Group(), new THREE.Vector3())).toBeNull()
  })

  it('a wall behind the enemy does not', () => {
    const { scene, camera } = setup()
    wall(scene, -300)
    expect(judgeTarget(target(-200), camera, collectOccluders(scene, camera, new Set()))).toBe('shootable')
  })

  it('see-through, hidden and skipped meshes hide nothing', () => {
    const { scene, camera } = setup()
    wall(scene, -100, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3 }))
    wall(scene, -110).visible = false
    const own = wall(scene, -120)
    expect(judgeTarget(target(-200), camera, collectOccluders(scene, camera, new Set([own])))).toBe('shootable')
  })

  it('a speck across the hall is too small to count', () => {
    const { scene, camera } = setup()
    // 50 units at 4000 units at 60° is ~8 px of a 720 px view, under MIN_ENEMY_PX.
    expect(judgeTarget(target(-4000), camera, collectOccluders(scene, camera, new Set()))).toBe('tiny')
  })

  it('behind the camera or outside the view is off screen', () => {
    const { scene, camera } = setup()
    const occluders = collectOccluders(scene, camera, new Set())
    expect(judgeTarget(target(200), camera, occluders)).toBe('offscreen')
    const wide: SightTarget = { id: 'side', position: new THREE.Vector3(1000, 0, -100), size: 50, radius: 25 }
    expect(judgeTarget(wide, camera, occluders)).toBe('offscreen')
  })

  it('counts each verdict', () => {
    const { scene, camera } = setup()
    wall(scene, -500)
    const c = countSight([target(-200), target(-600), target(-4000), target(300)], camera, collectOccluders(scene, camera, new Set()))
    expect(c).toEqual({ shootable: 1, occluded: 1, tiny: 1, ids: ['t-200'] })
  })
})

describe('largestCluster', () => {
  it('counts the most targets inside one assist circle centred on one of them', () => {
    expect(largestCluster([], 44)).toBe(0)
    expect(largestCluster([{ x: 0, y: 0 }], 44)).toBe(1)
    // Three inside 44 px of the middle one, a fourth far off.
    const pts = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: -30, y: 30 }, { x: 400, y: 0 }]
    expect(largestCluster(pts, 44)).toBe(3)
    expect(largestCluster(pts, 20)).toBe(1)
  })
})
