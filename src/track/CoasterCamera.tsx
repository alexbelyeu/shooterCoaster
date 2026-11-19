import { useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { TrackCurve } from './curves/TrackCurve'
import { type ArcTable, distanceAtT } from './arcLength'
import { TRACK_TUNNEL_EVENT, getTunnelDims } from './setPieces'
import { tunnelAt, tunnelDepth } from './tunnelRide.hot'
import { setRideProgress } from './rideProgress.hot'
import {
  advanceRide, jumpRide, resetRide, rideLaunches, rideOnLift, rideSpeedNorm, rideStepFrames, rideTopShare, rideZone, type RideSpeeds,
  type RideState,
} from './ridePhysics'
import { e2eRideSeconds, levelTimeStep } from '@/testing/e2eHook'
import { useGameStore } from '@/store/useGameStore'
import { sfx } from '@/audio/sfx'
import { eventBus } from '@/core/EventBus'
import WeaponViewModel from '@/combat/WeaponViewModel'
import {
  CAMERA_TRAUMA_EVENT, KILL_TRAUMA_MS, addTrauma, decayTrauma, effectiveShakeScale, killTrauma,
  rumbleAngles, shakeAngles, type ShakeAngles,
} from '@/combat/screenShake.hot'
import { useSettingsStore } from '@/store/useSettingsStore'
import { prefersReducedMotion, usePrefersReducedMotion } from '@/ui/reducedMotion'
import { fovForAspect, fovWithSpeed } from './cameraFov.hot'
import WindStreaks, { type StreakDrive } from './WindStreaks'
import { streakOpacity, streakRate } from './windStreaks'
import {
  LOOK_RESPONSE, createRigState, dipAmount, lateralAcceleration, lookAheadDirection, resetRig, rigAngles,
  sampleTrack, smoothingFactor, stepRig, triggerLaunch, verticalAcceleration, type RigAngles, type RigInput, type TrackSamples,
} from './cameraRig.hot'
import {
  introProgress, orbitPose, tourPose, type HeroShot,
} from './introCamera.hot'
import { introStartedAt, setCameraOffSeat } from '@/core/introShot'
import { buildIntroTour } from './introTour'
import type { PlacementBounds } from '@/entities/spawning/spawnPlacement'

interface CoasterCameraProps {
  curve: TrackCurve
  /** The curve's arc-length table (SceneManager's `trackTable`). */
  table: ArcTable
  /** `trackDimensions.trackScale`. */
  trackScale: number
  /** The level's ride (`ridePhysics.ts` `rideModel`). */
  speeds: RideSpeeds
  fov?: number
  near?: number
  far?: number
  heightOffset?: number
  enabled?: boolean
  /** The level's landmark: the intro's tour passes it, the results orbit it (#328). */
  hero: HeroShot
  /** Terrain as drawn. */
  groundFn: (x: number, z: number) => number
  /** An interior's walls: the tour and orbit stay inside them. */
  bounds?: PlacementBounds
}

const BASE_FOV = 80

const RAD_TO_DEG = 180 / Math.PI

/** Rides the track (port of Camera.js updateCamGame) with rotation-only weight from cameraRig.hot.ts; the mouse only aims. */
export default function CoasterCamera({
  curve,
  table,
  trackScale,
  speeds,
  fov = BASE_FOV,
  near = 1,
  far = 11000,
  heightOffset = 6,
  enabled = true,
  hero,
  groundFn,
  bounds,
}: CoasterCameraProps) {
  const { set } = useThree()
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)

  const ride = useRef<RideState>({ progress: 0, velocity: 0, time: 0 })
  const _position = useRef(new THREE.Vector3())
  const _tangent = useRef(new THREE.Vector3())
  const _lookAt = useRef(new THREE.Vector3())
  const scratch = useRef({
    samples: { behindT: 0, aheadT: 0, lookT: 0, span: 0, unitsPerT: 0 } as TrackSamples,
    tangentBehind: new THREE.Vector3(),
    tangentAhead: new THREE.Vector3(),
    lookTarget: new THREE.Vector3(),
    rig: { lateral: 0, vertical: 0, speed: 0, speedNorm: 0, descent: 0, lifting: false } as RigInput,
    angles: { pitch: 0, yaw: 0, roll: 0 } as RigAngles,
    rumble: { pitch: 0, yaw: 0, roll: 0 } as ShakeAngles,
  })
  const lookDir = useRef(new THREE.Vector3())
  const lookSnapped = useRef(false)
  const rig = useRef(createRigState())
  const streaks = useRef<StreakDrive>({ opacity: 0, time: 0 })
  const runId = useRef(-1)
  /** Waiting at the station last frame: the next playing frame is the launch. */
  const atStation = useRef(true)
  /** The v2 zone the car was in last frame, so entering a `launch` zone fires once. */
  const lastZone = useRef<ReturnType<typeof rideZone>>(null)
  const tunnelRamp = useMemo(() => getTunnelDims(trackScale).ramp, [trackScale])
  /** The tunnel the car is in (-1: none), for `track:tunnel` enter / exit. */
  const tunnelIndex = useRef(-1)
  useEffect(() => {
    const testApi = window.__SC_TEST__
    if (testApi) testApi.tunnel.spans = (table.tunnels ?? []).map((span) => ({ from: table.t[span.from], to: table.t[span.to] }))
  }, [table])
  useEffect(() => () => {
    if (tunnelIndex.current >= 0) eventBus.emit(TRACK_TUNNEL_EVENT, 'exit', tunnelIndex.current)
    tunnelIndex.current = -1
  }, [table])

  const heroGround = useMemo(() => hero.ground ?? groundFn(hero.x, hero.z), [hero, groundFn])
  const intro = useRef({
    anchor: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    /** Seconds into the results orbit; -1 before it starts. */
    orbitSeconds: -1,
    orbitYaw: 0,
    /** The tour's distance off the seat on its last frame. */
    lastOffset: 0,
    wasTouring: false,
  })
  // The car waits at the start through the intro, so the tour lands on the track's start. Reduced motion never
  // plays it, so it isn't built (cold, but tens of ms on a phone); the smoke pins it, so `?e2e=1` always builds it.
  const reducedMotion = usePrefersReducedMotion()
  const tour = useMemo(
    () => (reducedMotion && !window.__SC_TEST__
      ? null
      : buildIntroTour({ curve, table, seatT: 0, eyeHeight: heightOffset, trackScale, hero, heroGround, ground: groundFn, bounds })),
    [reducedMotion, curve, table, heightOffset, trackScale, hero, heroGround, groundFn, bounds],
  )
  useEffect(() => {
    const testApi = window.__SC_TEST__
    if (testApi && tour) testApi.intro.marks = tour.marks
  }, [tour])
  useEffect(() => {
    intro.current.anchor.set(hero.x, heroGround + hero.focus, hero.z)
  }, [hero, heroGround])
  useEffect(() => () => setCameraOffSeat(false), [])

  // Rotation-only trauma from kills and `camera:trauma` world events (#65); see screenShake.hot.ts.
  const shake = useRef({ trauma: 0, decayMs: KILL_TRAUMA_MS, time: 0, seed: 0 })
  const _angles = useRef<ShakeAngles>({ pitch: 0, yaw: 0, roll: 0 })

  useEffect(() => {
    const add = (amount: number, durationMs?: number) => {
      const k = shake.current
      // eslint-disable-next-line sc/no-math-random -- cosmetic: each shake's wobble pattern
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

  // The level's sound kit owns the ride's nodes; the ride only drives them.
  useEffect(() => () => {
    sfx().wind(0)
    sfx().chain(0)
  }, [])

  useFrame((_, delta) => {
    const cam = cameraRef.current
    if (!cam || !enabled) return

    // Slow-mo scales the ride, a pause holds it; the car waits at the start until GO, and on every new run.
    const store = useGameStore.getState()
    const testApi = window.__SC_TEST__
    const reducedMotion = prefersReducedMotion()
    const io = intro.current

    // Behind the results the camera leaves the seat and circles the landmark; reduced motion holds the last frame.
    if (store.phase === 'results') {
      setCameraOffSeat(!reducedMotion)
      streaks.current.opacity = 0
      sfx().wind(0)
      sfx().chain(0)
      if (reducedMotion) return
      if (io.orbitSeconds < 0) {
        io.orbitSeconds = 0
        io.orbitYaw = Math.atan2(cam.position.z - hero.z, cam.position.x - hero.x)
      } else io.orbitSeconds += delta
      orbitPose(hero, heroGround, io.orbitSeconds, io.orbitYaw, groundFn, bounds, io.pos, _lookAt.current)
      cam.position.copy(io.pos)
      cam.lookAt(_lookAt.current)
      if (Math.abs(cam.fov - effectiveFov.current) > 0.01) {
        cam.fov = effectiveFov.current
        cam.updateProjectionMatrix()
      }
      if (testApi) {
        testApi.intro.mode = 'orbit'
        testApi.intro.orbitSeconds = io.orbitSeconds
      }
      return
    }
    io.orbitSeconds = -1

    const phase = store.phase
    const beforeGo = phase === 'loading' || phase === 'intro' || phase === 'countdown'
    let jumped = beforeGo || !lookSnapped.current
    if (beforeGo || store.runId !== runId.current) {
      runId.current = store.runId
      resetRide(ride.current)
      jumped = true
    }
    const frameDelta = beforeGo || phase === 'paused' ? 0 : delta

    if (testApi?.rideTo != null) {
      jumpRide(ride.current, speeds, testApi.rideTo)
      testApi.rideTo = null
      jumped = true
    }
    // Today's rule only: a v2 ride follows its plan, so the override has nothing to hold.
    if (testApi?.rideSpeed != null) {
      ride.current.velocity = speeds.min + Math.min(Math.max(testApi.rideSpeed, 0), 1) * (speeds.max - speeds.min)
      testApi.rideSpeed = null
    }
    // The smoke's `rideRate` rides a share of the level time instead, so its ride doesn't depend on the frame rate (#305).
    const e2eRide = e2eRideSeconds(frameDelta)
    // Under it the look, the rig and the shake follow the level time too: on the frame's own time the camera
    // turned into a bend late on a fast runner, and saw different enemies there than on a slow one (#469).
    const effectiveDelta = (e2eRide === null ? frameDelta : levelTimeStep(frameDelta)) * (store.timeScale ?? 1)
    const rideFrames = e2eRide === null ? rideStepFrames(speeds, effectiveDelta) : e2eRide * (store.timeScale ?? 1) * 60
    advanceRide(ride.current, curve, speeds, rideFrames)
    const t = ride.current.progress
    _tangent.current.copy(curve.getTangentAt(t))
    setRideProgress(t)
    const dist = distanceAtT(table, t)
    const inTunnel = tunnelAt(table.tunnels, dist)
    if (inTunnel !== tunnelIndex.current) {
      if (tunnelIndex.current >= 0) eventBus.emit(TRACK_TUNNEL_EVENT, 'exit', tunnelIndex.current)
      if (inTunnel >= 0) eventBus.emit(TRACK_TUNNEL_EVENT, 'enter', inTunnel)
      tunnelIndex.current = inTunnel
    }
    const tunnel = tunnelDepth(table.tunnels, dist, tunnelRamp)

    _position.current.copy(curve.getPointAt(t))
    _position.current.y += heightOffset
    cam.position.copy(_position.current)
    const velocityNorm = rideSpeedNorm(ride.current, speeds)

    // Lateral acceleration from the tangents a few units either side of the car, measured along the track.
    const s = scratch.current
    const at = sampleTrack(table, t, trackScale, s.samples)
    const speed = ride.current.velocity * 60 * at.unitsPerT
    s.tangentBehind.copy(curve.getTangentAt(at.behindT))
    s.tangentAhead.copy(curve.getTangentAt(at.aheadT))
    const input = s.rig
    input.lateral = lateralAcceleration(_tangent.current, s.tangentBehind, s.tangentAhead, at.span, speed)
    input.vertical = verticalAcceleration(s.tangentBehind, s.tangentAhead, at.span, speed)
    input.speed = speed
    input.speedNorm = velocityNorm
    input.descent = -_tangent.current.y
    input.lifting = phase === 'playing' && rideOnLift(ride.current, speeds, _tangent.current.y)

    s.lookTarget.copy(curve.getPointAt(at.lookT))
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

    // GO, or a v2 ride's launch zone: the car is shoved (FOV kick, view tipped up) with the launch whoosh.
    const zone = rideZone(ride.current, speeds)
    if (phase === 'playing' && rideLaunches(atStation.current, zone, lastZone.current)) {
      triggerLaunch(rig.current)
      sfx().rideLaunch()
    }
    atStation.current = beforeGo
    lastZone.current = zone

    const motionScale = effectiveShakeScale(useSettingsStore.getState().screenShake, prefersReducedMotion())
    const r = stepRig(rig.current, input, effectiveDelta, trackScale)
    const view = rigAngles(r, s.angles)
    const roll = view.roll * motionScale
    const pitch = view.pitch * motionScale
    // The wheels' rumble, unloaded over an airtime crest.
    const rumble = rumbleAngles(r.speedNorm * (1 - 0.8 * r.airtime), r.time, motionScale, s.rumble)
    if (motionScale > 0) {
      cam.rotateX(pitch + rumble.pitch)
      cam.rotateY(view.yaw * motionScale + rumble.yaw)
      cam.rotateZ(roll + rumble.roll)
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

    const fov = fovWithSpeed(effectiveFov.current, r.speedNorm, motionScale, r.drop, tunnel, r.launch)
    const wind = streaks.current
    wind.opacity = streakOpacity(r.speedNorm, motionScale, tunnel)
    wind.time += effectiveDelta * streakRate(r.speedNorm, tunnel)
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }

    if (testApi) {
      testApi.rideProgress = t
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
      w.speed = r.speedNorm
      w.streaks = wind.opacity
      w.maxStreaks = Math.max(w.maxStreaks, wind.opacity)
      const feel = w.feel
      feel.launch = r.launch
      feel.dip = dipAmount(r)
      feel.airtime = r.airtime
      feel.lift = r.lift
      feel.rumble = Math.max(Math.abs(rumble.pitch), Math.abs(rumble.roll)) * RAD_TO_DEG
      const peak = w.feelMax
      peak.launch = Math.max(peak.launch, feel.launch)
      peak.dip = Math.max(peak.dip, feel.dip)
      peak.airtime = Math.max(peak.airtime, feel.airtime)
      peak.lift = Math.max(peak.lift, feel.lift)
      peak.rumble = Math.max(peak.rumble, feel.rumble)
      testApi.tunnel.index = inTunnel
      testApi.tunnel.depth = tunnel
    }

    // Through the intro the camera tours the level into the seat, landing on this pose (#328, #675); the loading
    // screen hides it waiting at the reveal, so the intro's first frame is one the level has drawn (#674).
    // `introAt` (e2e) pins it anywhere short of the results, so the smoke can shoot every level's tour.
    const pinned = testApi?.introAt ?? null
    const introNext = phase === 'loading' && !store.skipIntro
    const touring = tour !== null && (pinned != null || ((phase === 'intro' || introNext) && !reducedMotion))
    if (touring) {
      const startedAt = introStartedAt()
      const progress = pinned ?? (startedAt === null ? 0 : introProgress((performance.now() - startedAt) / 1000))
      const bank = tourPose(tour, progress, _position.current, dir, io.pos, io.dir)
      cam.position.copy(io.pos)
      _lookAt.current.copy(io.pos).add(io.dir)
      cam.lookAt(_lookAt.current)
      cam.rotateZ(bank)
      io.lastOffset = io.pos.distanceTo(_position.current)
      if (testApi) {
        const t = testApi.intro
        t.mode = 'tour'
        t.progress = progress
        t.height = io.pos.y - _position.current.y
        t.seatOffset = io.lastOffset
        t.seatAngle = io.dir.angleTo(dir) * RAD_TO_DEG
        s.lookTarget.copy(io.anchor).sub(io.pos)
        t.anchorAngle = io.dir.angleTo(s.lookTarget) * RAD_TO_DEG
        t.clearance = io.pos.y - groundFn(io.pos.x, io.pos.z)
      }
    } else {
      if (testApi) {
        if (io.wasTouring) testApi.intro.goOffset = io.lastOffset
        testApi.intro.mode = 'ride'
      }
    }
    io.wasTouring = touring
    setCameraOffSeat(touring && io.lastOffset > 0)

    // On the share of top speed, so the crawl (the gym never leaves it) still has wind and rumble.
    sfx().wind(rideTopShare(ride.current, speeds))
    sfx().chain(r.lift > 0.5 && phase === 'playing' ? (store.timeScale ?? 1) : 0)
  })

  return (
    <perspectiveCamera ref={cameraRef}>
      <WindStreaks drive={streaks.current} />
      <WeaponViewModel />
    </perspectiveCamera>
  )
}
