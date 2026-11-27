import * as THREE from 'three'

/** A seated enemy's mesh and the layers it draws on whenever it draws itself. */
export interface FleetSeat {
  mesh: THREE.Mesh
  layers: number
}

/**
 * Every live enemy of one kind in a single draw call (#1108): a level 7 wave puts 30 drones on screen, one draw each
 * as plain meshes. Each enemy keeps its own mesh (hit tests, the kill pop's flash, `drawnCentre`), off every camera's
 * layers while the fleet draws it. The fleet gathers its instances as the renderer updates the scene's matrices, so
 * they follow every transform made before the draw: one per enemy shown plain, a waiting or hidden one left out, a
 * flashed one or one past the fleet's size drawing itself. In the scene while it has a seat; ShaderWarmup compiles
 * the instanced program of every fleet SharedEnemyAssets exports.
 */
export class EnemyFleet extends THREE.InstancedMesh {
  private readonly seats: FleetSeat[] = []

  constructor(geometry: THREE.BufferGeometry, readonly plain: THREE.Material, size: number) {
    super(geometry, plain, size)
    this.count = 0
    this.frustumCulled = false
    this.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }

  /** Never in the way of a sight line or a hit: each enemy is judged by its own mesh. */
  override raycast() {}

  join(mesh: THREE.Mesh, scene: THREE.Object3D): FleetSeat {
    const seat = { mesh, layers: mesh.layers.mask }
    this.seats.push(seat)
    if (this.parent !== scene) scene.add(this)
    return seat
  }

  leave(seat: FleetSeat) {
    this.seats.splice(this.seats.indexOf(seat), 1)
    seat.mesh.layers.mask = seat.layers
    if (this.seats.length === 0) {
      this.count = 0
      this.removeFromParent()
    }
  }

  override updateMatrixWorld(force?: boolean) {
    super.updateMatrixWorld(force)
    this.count = 0
    for (let i = 0; i < this.seats.length; i++) {
      const seat = this.seats[i]
      const { mesh } = seat
      let shown = mesh.material === this.plain && this.count < this.instanceMatrix.count
      for (let o: THREE.Object3D | null = mesh; shown && o; o = o.parent) shown = o.visible
      if (!shown) {
        mesh.layers.mask = seat.layers
        continue
      }
      // The scene may reach this mesh after the fleet: bring its world matrix up to date first.
      mesh.updateWorldMatrix(true, false)
      this.setMatrixAt(this.count++, mesh.matrixWorld)
      mesh.layers.mask = 0
    }
    this.instanceMatrix.needsUpdate = true
  }
}
