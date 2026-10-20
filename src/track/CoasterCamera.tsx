import { useRef, useEffect, useLayoutEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { TrackCurve } from './curves/TrackCurve'
import { useGameStore } from '@/store/useGameStore'
import { startWindWhoosh, updateWindWhoosh, stopWindWhoosh } from '@/audio/SFXManager'
import { eventBus } from '@/core/EventBus'
import WeaponViewModel from '@/combat/WeaponViewModel'
import {
  CAMERA_TRAUMA_EVENT, KILL_TRAUMA_MS, addTrauma, decayTrauma, effectiveShakeScale, killTrauma,
  shakeAngles, type ShakeAngles,
} from '@/combat/screenShake'
import { useSettingsStore } from '@/store/useSettingsStore'
import { prefersReducedMotion } from '@/ui/reducedMotion'
import { fovForAspect } from './cameraFov'

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

const RAD_TO_DEG = 180 / Math.PI

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

  // Camera trauma (issue #65): ROTATION ONLY, on top of the track pose, which
  // is recomputed from scratch every frame — the camera position is never moved
  // for feedback, so the rails under it stay put. Kills and world events
  // (`camera:trauma`, e.g. the volcanic eruption) feed it. Fire recoil lives on
  // the weapon view-model, not here. Never touches progress/velocity.
  const shake = useRef({ trauma: 0, decayMs: KILL_TRAUMA_MS, time: 0, seed: 0 })
  const _angles = useRef<ShakeAngles>({ pitch: 0, yaw: 0, roll: 0 })

  useEffect(() => {
    const add = (amount: number, durationMs?: number) => {
      const k = shake.current
      if (k.trauma === 0) k.seed = (Math.random() * 1000) | 0
      addTrauma(k, amount, durationMs)
    }
    const onKill = (data: unknown) =>
      add(killTrauma((data as { combo?: number } | undefined)?.combo ?? 1))
    const onTrauma = (amount: unknown, durationMs: unknown) =>
      add(Number(amount), typeof durationMs === 'number' ? durationMs : undefined)
    eventBus.on('enemy:killed', onKill)
    eventBus.on(CAMERA_TRAUMA_EVENT, onTrauma as (...args: unknown[]) => void)
    return () => {
      eventBus.off('enemy:killed', onKill)
      eventBus.off(CAMERA_TRAUMA_EVENT, onTrauma as (...args: unknown[]) => void)
    }
  }, [])

  // ── Projection: aspect + FOV follow the canvas (issue #66) ──
  // R3F only re-applies camera.aspect when the canvas size/dpr *changes*, not
  // when a new default camera is set, so a camera mounted mid-session kept the
  // three.js default aspect of 1 (world squashed on phones, stretched on 16:9).
  // Apply it ourselves on mount and on every resize / rotation, and widen the
  // vertical FOV on portrait screens (see cameraFov.ts).
  const size = useThree((s) => s.size)
  const effectiveFov = useRef(fov)
  useLayoutEffect(() => {
    const cam = cameraRef.current
    if (!cam || !enabled || size.width <= 0 || size.height <= 0) return
    const aspect = size.width / size.height
    effectiveFov.current = fovForAspect(fov, aspect)
    cam.aspect = aspect
    cam.fov = effectiveFov.current
    cam.near = near
    cam.far = far
    cam.updateProjectionMatrix()
  }, [size.width, size.height, enabled, fov, near, far])

  // Set as default camera on mount (projection is already set above).
  useEffect(() => {
    if (cameraRef.current && enabled) set({ camera: cameraRef.current })
  }, [set, enabled])

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

    // ── Trauma: rotation-only, smooth noise (kills decay to 0 in ≤ 250 ms) ──
    const k = shake.current
    let traumaDeg = 0
    if (k.trauma > 0) {
      const scale = effectiveShakeScale(
        useSettingsStore.getState().screenShake,
        prefersReducedMotion(),
      )
      // Sample before decaying so even one very long frame shows the hit once.
      const a = shakeAngles(k.trauma, k.time, k.seed, scale, _angles.current)
      k.time += effectiveDelta
      decayTrauma(k, effectiveDelta * 1000)
      if (k.trauma === 0) k.time = 0
      cam.rotateX(a.pitch)
      cam.rotateY(a.yaw)
      cam.rotateZ(a.roll)
      traumaDeg = Math.max(Math.abs(a.pitch), Math.abs(a.yaw), Math.abs(a.roll)) * RAD_TO_DEG
    }
    const testApi = window.__SC_TEST__
    if (testApi) {
      // Translation off the track pose (must always be exactly 0) and the
      // largest trauma rotation this frame, in degrees.
      const offset = cam.position.distanceTo(_position.current)
      testApi.cameraTranslation.current = offset
      if (offset > testApi.cameraTranslation.max) testApi.cameraTranslation.max = offset
      testApi.cameraTrauma.current = traumaDeg
      if (traumaDeg > testApi.cameraTrauma.max) testApi.cameraTrauma.max = traumaDeg
    }

    // Update wind whoosh based on velocity
    const velocityNorm = Math.min(
      (velocity.current - effectiveMinSpeed) / (maxVelocity - effectiveMinSpeed),
      1,
    )
    updateWindWhoosh(Math.max(0, velocityNorm))

    if (Math.abs(cam.fov - effectiveFov.current) > 0.01) {
      cam.fov = effectiveFov.current
      cam.updateProjectionMatrix()
    }
  })

  return (
    <perspectiveCamera ref={cameraRef}>
      <WeaponViewModel />
    </perspectiveCamera>
  )
}
