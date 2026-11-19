import * as THREE from 'three'

/** Common interface for all track curve generators */
export interface TrackCurve {
  getPointAt(t: number): THREE.Vector3
  getTangentAt(t: number): THREE.Vector3
  /**
   * The rails' up at t (unit, perpendicular to the tangent) on a track that rolls: banks and inversions (#698).
   * Absent on a track that never rolls: its frame keeps right horizontal (`trackFrame`). Returns a shared vector.
   */
  getUpAt?(t: number): THREE.Vector3
}
