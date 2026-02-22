import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { TrackCurve } from './curves/TrackCurve'

interface TrackProgressOptions {
  curve: TrackCurve
  rollerSpeed: number
  minRollerSpeed: number
  heightOffset?: number
}

/**
 * Port of Camera.js:57-74 — gravity-based coaster velocity.
 * Returns a ref to an object3D that follows the track.
 */
export function useTrackProgress({
  curve,
  rollerSpeed,
  minRollerSpeed,
  heightOffset = 6,
}: TrackProgressOptions) {
  const state = useRef({
    progress: 0,
    velocity: 0,
  })

  const position = useRef(new THREE.Vector3())
  const tangent = useRef(new THREE.Vector3())
  const lookTarget = useRef(new THREE.Vector3())

  useFrame(() => {
    const s = state.current

    s.progress += s.velocity
    s.progress = ((s.progress % 1) + 1) % 1 // keep in [0, 1)

    position.current.copy(curve.getPointAt(s.progress))
    position.current.y += heightOffset

    tangent.current.copy(curve.getTangentAt(s.progress))
    s.velocity -= tangent.current.y * rollerSpeed
    s.velocity = Math.max(s.velocity, minRollerSpeed)

    lookTarget.current.copy(position.current).add(tangent.current)
  })

  return {
    state,
    position,
    tangent,
    lookTarget,
  }
}
