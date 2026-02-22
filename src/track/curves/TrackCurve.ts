import * as THREE from 'three'

/** Common interface for all track curve generators */
export interface TrackCurve {
  getPointAt(t: number): THREE.Vector3
  getTangentAt(t: number): THREE.Vector3
}
