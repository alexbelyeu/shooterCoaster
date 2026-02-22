import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { TrackCurve } from './curves/TrackCurve'
import { useGameStore } from '@/store/useGameStore'
import { startWindWhoosh, updateWindWhoosh, stopWindWhoosh } from '@/audio/SFXManager'

interface CoasterCameraProps {
  curve: TrackCurve
  rollerSpeed: number
  minRollerSpeed: number
  fov?: number
  near?: number
  far?: number
  heightOffset?: number
  enabled?: boolean
}

// Original game (2015) ran at ~30-45 fps on period hardware with frame-dependent
// physics. We normalise to 60 fps but then slow down so it *feels* like the original.
// Also cap max velocity so long downhill sections don't cause runaway speed.
const SPEED_FACTOR = 0.7
const MAX_VELOCITY_MULT = 5 // max velocity = minRollerSpeed * this

// FOV kick settings
const BASE_FOV = 80
const KICK_FOV = 90
const FOV_KICK_MILESTONES = [5, 10, 15]
const FOV_RETURN_SPEED = 3 // degrees per second to return to base

/**
 * Exact port of Camera.js updateCamGame.
 * Camera rides the track, always looking forward along tangent.
 * Mouse does NOT rotate the camera — it only controls aim for shooting.
 * FOV kicks on combo milestones for game feel.
 */
export default function CoasterCamera({
  curve,
  rollerSpeed,
  minRollerSpeed,
  fov = BASE_FOV,
  near = 1,
  far = 11000,
  heightOffset = 6,
  enabled = true,
}: CoasterCameraProps) {
  const { set, camera, gl } = useThree()
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)

  // Track state (mutable refs for useFrame perf — no allocations)
  const progress = useRef(0)
  const velocity = useRef(0)
  const _position = useRef(new THREE.Vector3())
  const _tangent = useRef(new THREE.Vector3())
  const _lookAt = useRef(new THREE.Vector3())

  // FOV kick state
  const currentFov = useRef(fov)
  const lastComboForKick = useRef(0)

  // Set as default camera on mount
  useEffect(() => {
    if (cameraRef.current && enabled) {
      cameraRef.current.fov = fov
      cameraRef.current.near = near
      cameraRef.current.far = far
      cameraRef.current.updateProjectionMatrix()
      set({ camera: cameraRef.current })
    }
  }, [set, enabled, fov, near, far])

  // Wind whoosh lifecycle
  useEffect(() => {
    startWindWhoosh()
    return () => stopWindWhoosh()
  }, [])

  useFrame((_, delta) => {
    const cam = cameraRef.current
    if (!cam || !enabled) return

    // Original physics were frame-rate dependent at 60fps.
    // Normalize: scale by (delta * 60) so behaviour matches original at any refresh rate.
    const dtScale = Math.min(delta * 60, 3) // clamp to avoid spiral on tab-switch

    // Slow-mo support: check timeScale from game store
    const timeScale = useGameStore.getState().timeScale ?? 1
    const effectiveDelta = delta * timeScale

    const effectiveRollerSpeed = rollerSpeed * SPEED_FACTOR
    const effectiveMinSpeed = minRollerSpeed * SPEED_FACTOR
    const maxVelocity = minRollerSpeed * MAX_VELOCITY_MULT * SPEED_FACTOR

    const dtScaleSlow = Math.min(effectiveDelta * 60, 3)

    progress.current += velocity.current * dtScaleSlow
    progress.current = ((progress.current % 1) + 1) % 1

    _position.current.copy(curve.getPointAt(progress.current))
    _position.current.y += heightOffset
    cam.position.copy(_position.current)

    _tangent.current.copy(curve.getTangentAt(progress.current))
    velocity.current -= _tangent.current.y * effectiveRollerSpeed * dtScaleSlow
    velocity.current = Math.max(velocity.current, effectiveMinSpeed)
    velocity.current = Math.min(velocity.current, maxVelocity)

    _lookAt.current.copy(_position.current).add(_tangent.current)
    cam.lookAt(_lookAt.current)

    // Update wind whoosh based on velocity
    const velocityNorm = Math.min(
      (velocity.current - effectiveMinSpeed) / (maxVelocity - effectiveMinSpeed),
      1,
    )
    updateWindWhoosh(Math.max(0, velocityNorm))

    // FOV kick on combo milestones
    const combo = useGameStore.getState().combo.count
    if (combo !== lastComboForKick.current && FOV_KICK_MILESTONES.includes(combo)) {
      currentFov.current = KICK_FOV
      lastComboForKick.current = combo
    } else {
      lastComboForKick.current = combo
    }

    // Ease FOV back to base
    if (currentFov.current > fov) {
      currentFov.current = Math.max(fov, currentFov.current - FOV_RETURN_SPEED * delta * 60)
    }

    if (Math.abs(cam.fov - currentFov.current) > 0.01) {
      cam.fov = currentFov.current
      cam.updateProjectionMatrix()
    }
  })

  return <perspectiveCamera ref={cameraRef} />
}
