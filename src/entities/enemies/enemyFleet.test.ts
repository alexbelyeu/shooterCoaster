import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { EnemyFleet } from './enemyFleet'

function setup(size = 4) {
  const geo = new THREE.BoxGeometry()
  const plain = new THREE.MeshBasicMaterial()
  const fleet = new EnemyFleet(geo, plain, size)
  const scene = new THREE.Scene()
  const enemy = (x: number) => {
    const group = new THREE.Group()
    group.position.x = x
    const mesh = new THREE.Mesh(geo, plain)
    group.add(mesh)
    scene.add(group)
    return { group, mesh }
  }
  return { fleet, scene, plain, enemy }
}

describe('EnemyFleet', () => {
  it('draws each plain, shown enemy as an instance at its world pose and takes its mesh off every layer', () => {
    const { fleet, scene, enemy } = setup()
    const a = enemy(5)
    const waiting = enemy(9)
    waiting.group.visible = false
    fleet.join(a.mesh, scene)
    fleet.join(waiting.mesh, scene)
    expect(fleet.parent).toBe(scene)
    a.group.position.x = 7 // moved after the fleet's place in the scene: still followed
    scene.updateMatrixWorld()
    const m = new THREE.Matrix4()
    fleet.getMatrixAt(0, m)
    expect([fleet.count, new THREE.Vector3().setFromMatrixPosition(m).x, a.mesh.layers.mask, waiting.mesh.layers.mask]).toEqual([1, 7, 0, 1])
  })

  it('lets a flashed enemy and one past its size draw themselves, and leaves the scene with its last seat', () => {
    const { fleet, scene, enemy } = setup(1)
    const a = enemy(0)
    const b = enemy(1)
    const seatA = fleet.join(a.mesh, scene)
    const seatB = fleet.join(b.mesh, scene)
    scene.updateMatrixWorld()
    const full = [fleet.count, a.mesh.layers.mask, b.mesh.layers.mask]
    a.mesh.material = new THREE.MeshBasicMaterial()
    scene.updateMatrixWorld()
    const flashed = [fleet.count, a.mesh.layers.mask, b.mesh.layers.mask]
    fleet.leave(seatA)
    fleet.leave(seatB)
    expect({ full, flashed, parent: fleet.parent, mask: b.mesh.layers.mask }).toEqual({ full: [1, 0, 1], flashed: [1, 1, 0], parent: null, mask: 1 })
  })
})
