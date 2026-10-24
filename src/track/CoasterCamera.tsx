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
import { fovForAspect, fovWithSpeed } from './cameraFov'
import {
  CURVATURE_SAMPLE_UNITS, LOOK_AHEAD_UNITS, LOOK_RESPONSE, createRigState, lookAheadDirection,
  resetRig, smoothingFactor, stepRig,
} from './cameraRig'

interface CoasterCameraProps {
  curve: TrackCurve
  trackLength: number
  /** `trackDimensions.trackScale`. */
  trackScale: number
  rollerSpeed: number
  minRollerSpeed: number
  fov?: number
  near?: number
  far?: number
  heightOffset?: number
  enabled?: boolean
}

// The 2015 game ran frame-dependent physics at ~30-45 fps: slow the 60 fps port to match, and cap runaway downhill speed.
const SPEED_FACTOR = 0.7
const MAX_VELOCITY_MULT = 5 // max velocity = minRollerSpeed * this

const BASE_FOV = 80

const RAD_TO_DEG = 180 / Math.PI
const WORLD_UP = new THREE.Vector3(0, 1, 0)

const wrap01 = (t: number) => ((t % 1) + 1) % 1

/** Rides the track (port of Camera.js updateCamGame) with rotation-only weight from cameraRig.ts; the mouse only aims. */
export default function CoasterCamera({
  curve,
  trackLength,
  trackScale,
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

  const progress = useRef(0)
  const velocity = useRef(0)
  const _position = useRef(new THREE.Vector3())
  const _tangent = useRef(new THREE.Vector3())
  const _lookAt = useRef(new THREE.Vector3())
  const scratch = useRef({
    behind: new THREE.Vector3(),
    ahead: new THREE.Vector3(),
    tangentBehind: new THREE.Vector3(),
    accel: new THREE.Vector3(),
    right: new THREE.Vector3(),
    lookTarget: new THREE.Vector3(),
  })
  const lookDir = useRef(new THREE.Vector3())
  const lookSnapped = useRef(false)
  const rig = useRef(createRigState())

  // Rotation-only trauma from kills and `camera:trauma` world events (#65); see screenShake.ts.
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

  // R3F only re-applies aspect when the canvas size changes, not when a new default camera mounts (#66).
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

  useEffect(() => {
    if (cameraRef.current && enabled) set({ camera: cameraRef.current })
  }, [set, enabled])

  useEffect(() => {
    startWindWhoosh()
    return () => stopWindWhoosh()
  }, [])

  useFrame((_, delta) => {
    const cam = cameraRef.current
    if (!cam || !enabled) return

    // Slow-mo scales the ride; the car waits at the start through the countdown (Replay included).
    const { timeScale, phase } = useGameStore.getState()
    const countdown = phase === 'countdown'
    let jumped = countdown || !lookSnapped.current
    if (countdown) {
      progress.current = 0
      velocity.current = 0
    }
    const effectiveDelta = countdown ? 0 : delta * (timeScale ?? 1)

    const effectiveRollerSpeed = rollerSpeed * SPEED_FACTOR
    const effectiveMinSpeed = minRollerSpeed * SPEED_FACTOR
    const maxVelocity = minRollerSpeed * MAX_VELOCITY_MULT * SPEED_FACTOR

    const dtScaleSlow = Math.min(effectiveDelta * 60, 3)

    const testApi = window.__SC_TEST__
    if (testApi?.rideTo != null) {
      progress.current = testApi.rideTo
      testApi.rideTo = null
      jumped = true
    }
    progress.current += velocity.current * dtScaleSlow
    progress.current = wrap01(progress.current)
    const t = progress.current

    _position.current.copy(curve.getPointAt(t))
    _position.current.y += heightOffset
    cam.position.copy(_position.current)

    _tangent.current.copy(curve.getTangentAt(t))
    velocity.current -= _tangent.current.y * effectiveRollerSpeed * dtScaleSlow
    velocity.current = Math.max(velocity.current, effectiveMinSpeed)
    velocity.current = Math.min(velocity.current, maxVelocity)
    const velocityNorm = Math.max(
      0,
      Math.min((velocity.current - effectiveMinSpeed) / (maxVelocity - effectiveMinSpeed), 1),
    )

    // Lateral acceleration = curvature × v², from the track a few units either side of the car.
    const s = scratch.current
    const h = (CURVATURE_SAMPLE_UNITS * trackScale) / trackLength
    s.behind.copy(curve.getPointAt(wrap01(t - h)))
    s.ahead.copy(curve.getPointAt(wrap01(t + h)))
    const unitsPerT = s.behind.distanceTo(s.ahead) / (2 * h)
    const speed = velocity.current * 60 * unitsPerT
    let lateral = 0
    if (unitsPerT > 0) {
      s.tangentBehind.copy(curve.getTangentAt(wrap01(t - h)))
      s.accel
        .copy(curve.getTangentAt(wrap01(t + h)))
        .sub(s.tangentBehind)
        .multiplyScalar((speed * speed) / (2 * h * unitsPerT))
      lateral = s.accel.dot(s.right.crossVectors(_tangent.current, WORLD_UP).normalize())
    }

    const aheadT = wrap01(t + (LOOK_AHEAD_UNITS * trackScale) / Math.max(unitsPerT, 1e-6))
    s.lookTarget.copy(curve.getPointAt(aheadT))
    s.lookTarget.y += heightOffset
    s.lookTarget.sub(_position.current).normalize()
    lookAheadDirection(_tangent.current, s.lookTarget, s.lookTarget)
    const dir = lookDir.current
    if (jumped) {
      dir.copy(s.lookTarget)
      lookSnapped.current = true
      resetRig(rig.current)
    } else {
      dir.lerp(s.lookTarget, smoothingFactor(effectiveDelta, LOOK_RESPONSE)).normalize()
    }
    _lookAt.current.copy(_position.current).add(dir)
    cam.lookAt(_lookAt.current)

    const motionScale = effectiveShakeScale(useSettingsStore.getState().screenShake, prefersReducedMotion())
    const r = stepRig(rig.current, lateral, speed, velocityNorm, effectiveDelta, trackScale)
    const roll = r.roll * motionScale
    const pitch = r.pitch * motionScale
    if (motionScale > 0) {
      cam.rotateX(pitch)
      cam.rotateZ(roll)
    }

    const k = shake.current
    let traumaDeg = 0
    if (k.trauma > 0) {
      // Sample before decaying so even one very long frame shows the hit once.
      const a = shakeAngles(k.trauma, k.time, k.seed, motionScale, _angles.current)
      k.time += effectiveDelta
      decayTrauma(k, effectiveDelta * 1000)
      if (k.trauma === 0) k.time = 0
      cam.rotateX(a.pitch)
      cam.rotateY(a.yaw)
      cam.rotateZ(a.roll)
      traumaDeg = Math.max(Math.abs(a.pitch), Math.abs(a.yaw), Math.abs(a.roll)) * RAD_TO_DEG
    }

    const fov = fovWithSpeed(effectiveFov.current, r.speedNorm, motionScale)
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }

    if (testApi) {
      const offset = cam.position.distanceTo(_position.current)
      testApi.cameraTranslation.current = offset
      if (offset > testApi.cameraTranslation.max) testApi.cameraTranslation.max = offset
      testApi.cameraTrauma.current = traumaDeg
      if (traumaDeg > testApi.cameraTrauma.max) testApi.cameraTrauma.max = traumaDeg
      const w = testApi.cameraWeight
      w.roll = roll * RAD_TO_DEG
      w.pitch = pitch * RAD_TO_DEG
      w.fovKick = cam.fov - effectiveFov.current
      w.maxRoll = Math.max(w.maxRoll, Math.abs(w.roll))
      w.maxPitch = Math.max(w.maxPitch, Math.abs(w.pitch))
      w.maxFovKick = Math.max(w.maxFovKick, w.fovKick)
    }

    updateWindWhoosh(velocityNorm)
  })

  return (
    <perspectiveCamera ref={cameraRef}>
      <WeaponViewModel />
    </perspectiveCamera>
  )
}
