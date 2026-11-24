import { useCallback, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { gameClockStep } from '@/core/gameClock'
import { getExplosionPool } from '@/effects/explosionPoolHandle'
import { BOSS_DEFEAT_DEATH_STYLE, HELI_CRASH_DEATH_STYLE, HELI_PART_DEATH_STYLE, HELI_SMOKE_DEATH_STYLE } from '@/effects/deathStyles'
import type { HeightFunction } from '@/utils/terrainNoise'
import BossBase, { type BossFrame, type BossProps } from './BossBase'
import { isExposed, weakPointHp, type WeakPointSpec } from './bossModel'
import { HELICOPTER, HELI_LAYOUT } from './bossSpecs'
import {
  BEAM_SPREAD, HELI_BEAM_GEO, HELI_BEAM_MAT, HELI_BLADES_GEO, HELI_BODY_GEO, HELI_HUB_GEO, HELI_HUB_MAT, HELI_MAT,
  HELI_ROTOR_AT, HELI_ROTOR_BLUR_GEO, HELI_ROTOR_BLUR_MAT, HELI_SEARCHLIGHT_GEO, HELI_SPOT_GEO, HELI_TAIL_BLUR_SCALE,
  HELI_TAIL_ROTOR_GEO,
} from './helicopterAssets'
import { flatForward } from './bossAim.hot'
import { followHeading, smooth, type FlatDir } from './bossCycle.hot'
import { HELI, HELI_FALL, beamSpot, dropInHeight, heliPose, type BeamSpot, type HeliPose } from './helicopterMotion.hot'

/** The beam's opacity once it has swept in; it fades in over the tell. */
const BEAM_OPACITY = 0.5
/** The crash: once it is this near the street under it. */
const CRASH_CLEARANCE = 30

const _fwd = new THREE.Vector3()
const _cam = new THREE.Vector3()
const _anchor = new THREE.Vector3()
const _lamp = new THREE.Vector3()
const _spot = new THREE.Vector3()
const _at = new THREE.Vector3()
const _pose: HeliPose = { dy: 0, pitch: 0, roll: 0, yaw: 0, drop: 0 }
const _beam: BeamSpot = { ahead: 0, side: 0 }

/** Where it hovers `age` s into its fight: ahead of the camera on the rider's heading, weaving across the street. */
function anchorAt(out: THREE.Vector3, cam: THREE.Vector3, h: FlatDir, age: number, ground: HeightFunction): THREE.Vector3 {
  const side = HELI.side * Math.sin(age * HELI.weaveRate)
  out.set(cam.x + h.x * HELI.ahead - h.z * side, 0, cam.z + h.z * HELI.ahead + h.x * side)
  out.y = Math.max(cam.y + HELI.above, ground(out.x, out.z) + HELI.minClearance)
  return out
}

/** The searchlight's spot on the street for `spot`, on the rider's heading from the camera. */
function spotAt(out: THREE.Vector3, cam: THREE.Vector3, h: FlatDir, spot: BeamSpot, ground: HeightFunction): THREE.Vector3 {
  out.set(cam.x + h.x * spot.ahead - h.z * spot.side, 0, cam.z + h.z * spot.ahead + h.x * spot.side)
  out.y = ground(out.x, out.z) + 1
  return out
}

/** Lays the beam from the lamp at `from` onto the street at `to`, its spot where it lands. */
function layBeam(beam: THREE.Group, cone: THREE.Object3D, pool: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
  const length = from.distanceTo(to)
  beam.visible = true
  cone.position.copy(from)
  cone.lookAt(to)
  cone.scale.setScalar(length)
  pool.position.copy(to)
  pool.scale.setScalar(length * BEAM_SPREAD)
}

const searchlight = <mesh geometry={HELI_SEARCHLIGHT_GEO} material={HELI_MAT} />
const tailRotor = (
  <>
    <mesh geometry={HELI_TAIL_ROTOR_GEO} material={HELI_MAT} />
    <mesh geometry={HELI_ROTOR_BLUR_GEO} material={HELI_ROTOR_BLUR_MAT} rotation={[0, 0, Math.PI / 2]} scale={HELI_TAIL_BLUR_SCALE} />
  </>
)
const hub = <mesh geometry={HELI_HUB_GEO} material={HELI_HUB_MAT} />

function renderWeakPoint(w: WeakPointSpec) {
  if (w.id === 'searchlight') return searchlight
  if (w.id === 'tail-rotor') return tailRotor
  return hub
}

/**
 * Neon Metropolis finale (#325): a helicopter drops in over the street ahead, its searchlight sweeping the track. Shoot
 * out the searchlight and the tail rotor (it yaws about without it), then the main rotor's hub: it spins down into the
 * street trailing smoke and crashes in sparks.
 */
export default function Helicopter(props: BossProps) {
  const { incoming, active, groundFn } = props
  const motion = useRef({ placed: false, heading: { x: 0, z: -1 }, tell: 0, fallFrom: 0, nextSmoke: 0, crashed: false }).current
  const rotor = useRef<THREE.Group>(null)
  const beam = useRef<THREE.Group>(null)
  const cone = useRef<THREE.Mesh>(null)
  const pool = useRef<THREE.Mesh>(null)
  const [tellStep] = useState(() => {
    HELI_BEAM_MAT.opacity = 0
    HELI_HUB_MAT.emissiveIntensity = 0
    return gameClockStep()
  })

  // The tell: the beam sweeps in from off the side of the frame, from up where it will drop in from. On game time.
  useFrame(({ camera }) => {
    if (!incoming || active || !beam.current || !cone.current || !pool.current) return
    const dt = tellStep()
    const first = motion.tell === 0
    motion.tell += dt
    flatForward(camera, _fwd)
    followHeading(motion.heading, _fwd.x, _fwd.z, dt, first)
    camera.getWorldPosition(_cam)
    anchorAt(_lamp, _cam, motion.heading, 0, groundFn).y += HELI.dropIn
    const k = motion.tell / HELICOPTER.tell.seconds
    spotAt(_spot, _cam, motion.heading, beamSpot(_beam, motion.tell, k), groundFn)
    layBeam(beam.current, cone.current, pool.current, _lamp, _spot)
    HELI_BEAM_MAT.opacity = BEAM_OPACITY * smooth(k)
  })

  const move = useCallback(
    ({ root, parts, camera, state, dt, age, sinceDefeat }: BossFrame) => {
      const fighting = sinceDefeat < 0
      const tailLost = weakPointHp(state, 'tail-rotor') <= 0
      heliPose(_pose, age, tailLost, sinceDefeat)
      flatForward(camera, _fwd)
      followHeading(motion.heading, _fwd.x, _fwd.z, dt, !motion.placed)
      const h = motion.heading
      camera.getWorldPosition(_cam)
      anchorAt(_anchor, _cam, h, age, groundFn)
      _anchor.y += _pose.dy + dropInHeight(age)

      const k = 1 - Math.exp(-dt / HELI.followTau)
      if (!motion.placed) {
        root.rotation.order = 'YXZ'
        root.position.copy(_anchor)
        motion.placed = true
      } else if (fighting) {
        root.position.lerp(_anchor, k)
        motion.fallFrom = root.position.y
      } else {
        root.position.x += (_anchor.x - root.position.x) * k
        root.position.z += (_anchor.z - root.position.z) * k
        const street = groundFn(root.position.x, root.position.z)
        root.position.y = Math.max(street + CRASH_CLEARANCE, motion.fallFrom - _pose.drop)
        if (!motion.crashed && root.position.y <= street + CRASH_CLEARANCE) {
          motion.crashed = true
          root.visible = false
          getExplosionPool()?.explode(root.position, HELI_CRASH_DEATH_STYLE)
        }
      }
      // Nose (+z) back at the rider.
      root.rotation.set(_pose.pitch, Math.atan2(-h.x, -h.z) + _pose.yaw, _pose.roll)

      const spin = fighting ? 1 : Math.max(0, 1 - sinceDefeat / HELI_FALL.exitSeconds)
      if (rotor.current) rotor.current.rotation.y += HELI.mainRotor * dt * spin
      const tail = parts.get('tail-rotor')
      if (tail) tail.rotation.x += HELI.tailRotor * dt
      HELI_HUB_MAT.emissiveIntensity = isExposed(state, 'hub') ? 0.7 + 0.5 * Math.sin(age * 7) : 0

      root.updateMatrixWorld(true)
      if (!fighting && !motion.crashed && sinceDefeat >= motion.nextSmoke) {
        motion.nextSmoke = sinceDefeat + HELI_FALL.smokeEvery
        if (tail) getExplosionPool()?.explode(tail.getWorldPosition(_at), HELI_SMOKE_DEATH_STYLE)
      }

      const lamp = parts.get('searchlight')
      const lit = fighting && weakPointHp(state, 'searchlight') > 0
      if (!beam.current || !cone.current || !pool.current) return
      if (!lit || !lamp) {
        beam.current.visible = false
        return
      }
      spotAt(_spot, _cam, h, beamSpot(_beam, motion.tell + age), groundFn)
      lamp.lookAt(_spot)
      lamp.getWorldPosition(_lamp)
      layBeam(beam.current, cone.current, pool.current, _lamp, _spot)
      HELI_BEAM_MAT.opacity = BEAM_OPACITY
    },
    [groundFn, motion],
  )

  const body = (
    <>
      <mesh geometry={HELI_BODY_GEO} material={HELI_MAT} />
      <group ref={rotor} position={HELI_ROTOR_AT}>
        <mesh geometry={HELI_BLADES_GEO} material={HELI_MAT} />
        <mesh geometry={HELI_ROTOR_BLUR_GEO} material={HELI_ROTOR_BLUR_MAT} scale={[HELI_LAYOUT.rotorRadius, 1, HELI_LAYOUT.rotorRadius]} />
      </group>
    </>
  )

  return (
    <BossBase
      {...props}
      spec={HELICOPTER}
      move={move}
      body={body}
      renderWeakPoint={renderWeakPoint}
      exitSeconds={HELI_FALL.exitSeconds}
      deathStyle={HELI_PART_DEATH_STYLE}
      defeatBurst={BOSS_DEFEAT_DEATH_STYLE}
    >
      <group ref={beam} visible={false}>
        <mesh ref={cone} geometry={HELI_BEAM_GEO} material={HELI_BEAM_MAT} frustumCulled={false} renderOrder={2} />
        <mesh ref={pool} geometry={HELI_SPOT_GEO} material={HELI_BEAM_MAT} frustumCulled={false} renderOrder={2} />
      </group>
    </BossBase>
  )
}
