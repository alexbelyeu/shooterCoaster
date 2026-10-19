import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { TrackCurve } from './curves/TrackCurve'
import { useGameStore } from '@/store/useGameStore'
import { startWindWhoosh, updateWindWhoosh, stopWindWhoosh } from '@/audio/SFXManager'
import { eventBus } from '@/core/EventBus'
import MuzzleFlash from '@/combat/MuzzleFlash'
import {
  FIRE_KICK_MS, FIRE_KICK_RAD, KILL_SHAKE_MS, KILL_SHAKE_COMBO_CAP, MAX_SHAKE_UNITS,
} from '@/combat/hitFeedback'

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

/** Kill-shake displacement (world units) for a combo, capped at MAX_SHAKE_UNITS. */
function killShakeAmplitude(combo: number): number {
  const c = Math.min(Math.max(combo, 1), KILL_SHAKE_COMBO_CAP)
  return 0.8 + (MAX_SHAKE_UNITS - 0.8) * ((c - 1) / (KILL_SHAKE_COMBO_CAP - 1))
}

/**
 * Exact port of Camera.js updateCamGame.
 * Camera rides the track, always looking forward along tangent.
 * Mouse does NOT rotate the camera — it only controls aim for shooting.
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
  const { set } = useThree()
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)

  // Track state (mutable refs for useFrame perf — no allocations)
  const progress = useRef(0)
  const velocity = useRef(0)
  const _position = useRef(new THREE.Vector3())
  const _tangent = useRef(new THREE.Vector3())
  const _lookAt = useRef(new THREE.Vector3())
  const _shakeOffset = useRef(new THREE.Vector3())

  // Screen kick / shake: purely additive on top of the track pose, which is
  // recomputed from scratch every frame — so when the timers hit zero the
  // camera is exactly back on the track. Never touches progress/velocity.
  const shake = useRef({
    fireMs: 0, fireSeed: 0,
    killMs: 0, killAmp: 0, killRoll: 0,
    time: 0,
  })

  useEffect(() => {
    const onFire = () => {
      const k = shake.current
      k.fireMs = FIRE_KICK_MS
      k.fireSeed = Math.random() * Math.PI * 2
    }
    const onKill = (data: unknown) => {
      const k = shake.current
      const combo = (data as { combo?: number } | undefined)?.combo ?? 1
      const amp = killShakeAmplitude(combo)
      // Overlapping kills keep the stronger shake rather than stacking.
      k.killAmp = k.killMs > 0 ? Math.max(k.killAmp, amp) : amp
      k.killRoll = 0.002 + 0.006 * (amp / MAX_SHAKE_UNITS)
      k.killMs = KILL_SHAKE_MS
    }
    eventBus.on('weapon:fire', onFire)
    eventBus.on('enemy:killed', onKill)
    return () => {
      eventBus.off('weapon:fire', onFire)
      eventBus.off('enemy:killed', onKill)
    }
  }, [])

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

    // ── Screen kick (fire) + shake (kill) ──
    const k = shake.current
    let shakeLen = 0
    if (k.fireMs > 0 || k.killMs > 0) {
      const dtMs = effectiveDelta * 1000
      k.time += effectiveDelta
      k.fireMs = Math.max(0, k.fireMs - dtMs)
      k.killMs = Math.max(0, k.killMs - dtMs)
      const fireEnv = (k.fireMs / FIRE_KICK_MS) ** 2
      const killEnv = (k.killMs / KILL_SHAKE_MS) ** 2

      if (fireEnv > 0) {
        // Recoil: mostly pitch-up with a little random yaw (~1–2 px).
        cam.rotateX(FIRE_KICK_RAD * fireEnv * (0.7 + 0.3 * Math.sin(k.fireSeed)))
        cam.rotateY(FIRE_KICK_RAD * 0.5 * fireEnv * Math.cos(k.fireSeed * 3))
      }
      if (killEnv > 0) {
        const a = k.killAmp * killEnv
        _shakeOffset.current.set(
          a * Math.sin(k.time * 71 + 1.3),
          a * Math.sin(k.time * 53 + 4.1),
          0,
        )
        // Hard cap: never more than MAX_SHAKE_UNITS from the track.
        _shakeOffset.current.clampLength(0, MAX_SHAKE_UNITS)
        shakeLen = _shakeOffset.current.length()
        _shakeOffset.current.applyQuaternion(cam.quaternion)
        cam.position.add(_shakeOffset.current)
        cam.rotateZ(k.killRoll * killEnv * Math.sin(k.time * 37))
      } else {
        k.killAmp = 0
      }
    }
    const testApi = window.__SC_TEST__
    if (testApi) {
      testApi.cameraShake.current = shakeLen
      if (shakeLen > testApi.cameraShake.max) testApi.cameraShake.max = shakeLen
    }

    // Update wind whoosh based on velocity
    const velocityNorm = Math.min(
      (velocity.current - effectiveMinSpeed) / (maxVelocity - effectiveMinSpeed),
      1,
    )
    updateWindWhoosh(Math.max(0, velocityNorm))

    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
  })

  return (
    <perspectiveCamera ref={cameraRef}>
      <MuzzleFlash />
    </perspectiveCamera>
  )
}
