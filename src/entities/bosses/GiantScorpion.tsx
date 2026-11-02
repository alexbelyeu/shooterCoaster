import { useCallback, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { useGameStore } from '@/store/useGameStore'
import { CAMERA_TRAUMA_EVENT } from '@/combat/screenShake'
import { getExplosionPool } from '@/effects/explosionPoolHandle'
import { SAND_BURST_DEATH_STYLE, SCORPION_SHARD_DEATH_STYLE } from '@/effects/deathStyles'
import { buildTrackIndex } from '@/levels/environments/shared/trackClearance'
import { desertObstacles, layoutDesert } from '@/levels/environments/biomes/desert/desertLayout'
import BossBase, { type BossFrame, type BossProps } from './BossBase'
import BossConfetti from './BossConfetti'
import { isExposed, type WeakPointSpec } from './bossModel'
import { GIANT_SCORPION } from './bossSpecs'
import {
  SCORPION_BODY_GEO, SCORPION_CLAW_GEO, SCORPION_FINGER_GEO, SCORPION_FINGER_HINGE, SCORPION_GLOW_GEO, SCORPION_GLOW_MAT,
  SCORPION_LIMB_GEO, SCORPION_LIMB_MAT, SCORPION_MOUND_GEO, SCORPION_MOUND_MAT, SCORPION_SHELL_MAT, SCORPION_STINGER_EXPOSED_MAT,
  SCORPION_STINGER_GEO, SCORPION_STINGER_MAT, SCORPION_TAIL_MAT, SCORPION_TAIL_SEGMENT_GEO,
} from './bossAssets'
import {
  PERCH, SCORPION_BODY, SCORPION_RISE, SCORPION_TAIL, advanceGait, approachAngle, createTailPose, faceYaw, footStep, layTail,
  lungeAmount, lungeImpactBetween, pickPerch, riseOffset, type FootStep, type Perch, type PerchInput,
} from './scorpionMotion'

const B = SCORPION_BODY
const T = SCORPION_TAIL
const LIMB_COUNT = 20
const TAIL_IDS = Array.from({ length: T.segments }, (_, i) => `tail-${i}`)
const HEADING_TAU = 2.5
const FOLLOW_TAU = 1
const TURN_TAU = 0.6
/** Turned this much from the rider towards its heading: a three-quarter view of claws and tail. */
const FACE_BLEND = 0.35
/** How far its middle may sit below a crest under it. */
const MAX_BELLY_DIP = 90
const MOUND_RADIUS = 300
const MOUND_HEIGHT = 90
const MOUND_SETTLE = 120
const PUFF_EVERY_S = 0.6
const STINGER_REACH = 150
const RISE_TRAUMA = [0.35, 500] as const
const LUNGE_TRAUMA = [0.3, 350] as const
const DEFEAT_TRAUMA = [0.7, 900] as const
const EXIT_SECONDS = SCORPION_RISE.sinkS + 0.6

const _m = new THREE.Matrix4()
const _cam = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _p = new THREE.Vector3()

function sandBurst(x: number, y: number, z: number, trauma: readonly [number, number]) {
  getExplosionPool()?.explode(_p.set(x, y, z), SAND_BURST_DEATH_STYLE)
  eventBus.emit(CAMERA_TRAUMA_EVENT, trauma[0], trauma[1])
}

/** Root-local segment a → b of radius r. */
function setLimb(limbs: THREE.InstancedMesh, i: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number) {
  const dx = bx - ax
  const dy = by - ay
  const dz = bz - az
  const len = Math.hypot(dx, dy, dz) || 1
  const ux = dx / len
  const uy = dy / len
  const uz = dz / len
  // x' = u × up, or +x when the limb is vertical; z' = x' × u.
  let px = -uz
  let pz = ux
  const pl = Math.hypot(px, pz)
  if (pl < 1e-4) {
    px = 1
    pz = 0
  } else {
    px /= pl
    pz /= pl
  }
  const qx = -pz * uy
  const qy = pz * ux - px * uz
  const qz = px * uy
  _m.set(px * r, ux * len, qx * r, ax, 0, uy * len, qy * r, ay, pz * r, uz * len, qz * r, az, 0, 0, 0, 1)
  limbs.setMatrixAt(i, _m)
}

/** Desert finale: break both claws and the four tail segments, then the stinger on the bare stub. */
export default function GiantScorpion(props: BossProps) {
  const { track, groundFn, incoming, active } = props
  const camera = useThree((s) => s.camera)
  const limbsRef = useRef<THREE.InstancedMesh>(null)
  const moundRef = useRef<THREE.Mesh>(null)

  const input = useMemo<PerchInput>(
    () => ({
      index: buildTrackIndex(track),
      avoid: desertObstacles(layoutDesert(groundFn, track).mesas),
      camera: { x: 0, z: 0 },
      forwardX: 0,
      forwardZ: -1,
    }),
    [track, groundFn],
  )

  const sim = useMemo(
    () => ({
      heading: new THREE.Vector3(),
      headed: false,
      perch: { x: 0, z: 0, slot: 0, sign: 1 } as Perch,
      perched: false,
      placed: false,
      yaw: 0,
      gait: 0,
      lastX: 0,
      lastZ: 0,
      lastAge: 0,
      tell: -1,
      nextPuff: 0,
      mound: 0,
      defeatBurst: false,
      tail: createTailPose(),
      step: { dz: 0, lift: 0 } as FootStep,
      footGround: new Float32Array(2 * B.feet.length),
      liveTail: [0, 0, 0, 0],
      fingers: new Map<string, THREE.Mesh>(),
    }),
    [],
  )

  /** Heading smoothed through the loops, like the Blimp's. */
  const aim = useCallback(
    (dt: number) => {
      camera.getWorldPosition(_cam)
      camera.getWorldDirection(_fwd)
      _fwd.y = 0
      if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1)
      _fwd.normalize()
      if (!sim.headed) {
        sim.heading.copy(_fwd)
        sim.headed = true
      } else {
        sim.heading.lerp(_fwd, 1 - Math.exp(-dt / HEADING_TAU))
        if (sim.heading.lengthSq() < 1e-6) sim.heading.copy(_fwd)
        sim.heading.normalize()
      }
      input.camera.x = _cam.x
      input.camera.z = _cam.z
      input.forwardX = sim.heading.x
      input.forwardZ = sim.heading.z
      if (pickPerch(sim.perch, input)) sim.perched = true
      else if (!sim.perched) {
        const [ahead, side] = PERCH.slots[0]
        sim.perch.x = _cam.x + sim.heading.x * ahead - sim.heading.z * side
        sim.perch.z = _cam.z + sim.heading.z * ahead + sim.heading.x * side
      }
    },
    [camera, sim, input],
  )

  // The tell runs before BossBase's frame does: the dune heaves where it will burst out.
  useFrame((_, delta) => {
    const mound = moundRef.current
    if (!mound) return
    const { phase, timeScale } = useGameStore.getState()
    const dt = phase === 'playing' ? delta * timeScale : 0
    if (incoming && !active) {
      if (sim.tell < 0) {
        sim.tell = 0
        eventBus.emit('scorpion:burrow')
      }
      sim.tell += dt
      aim(dt)
      const ground = groundFn(sim.perch.x, sim.perch.z)
      sim.mound = MOUND_HEIGHT * Math.min(1, sim.tell / 2) * (1 + 0.12 * Math.sin(sim.tell * 11))
      mound.position.set(sim.perch.x, ground - 20, sim.perch.z)
      if (sim.tell >= sim.nextPuff) {
        sim.nextPuff += PUFF_EVERY_S
        getExplosionPool()?.explode(_p.set(sim.perch.x, ground + sim.mound * 0.6, sim.perch.z), SAND_BURST_DEATH_STYLE)
      }
    } else if (sim.mound > 0) {
      sim.mound = Math.max(0, sim.mound - dt * MOUND_SETTLE)
    }
    mound.visible = sim.mound > 0
    mound.scale.set(MOUND_RADIUS, Math.max(sim.mound, 1e-3), MOUND_RADIUS)
  })

  const move = useCallback(
    ({ root, parts, state, dt, age, sinceDefeat }: BossFrame) => {
      const limbs = limbsRef.current
      if (!limbs) return
      const fighting = sinceDefeat < 0
      if (fighting) aim(dt)
      const p = sim.perch
      if (!sim.placed) {
        root.position.set(p.x, 0, p.z)
        sim.lastX = p.x
        sim.lastZ = p.z
      } else if (fighting) {
        const k = 1 - Math.exp(-dt / FOLLOW_TAU)
        root.position.x += (p.x - root.position.x) * k
        root.position.z += (p.z - root.position.z) * k
      }
      const x = root.position.x
      const z = root.position.z
      const target = faceYaw(Math.atan2(_cam.x - x, _cam.z - z), Math.atan2(sim.heading.x, sim.heading.z), FACE_BLEND)
      sim.yaw = sim.placed ? approachAngle(sim.yaw, target, 1 - Math.exp(-dt / TURN_TAU)) : target
      root.rotation.y = sim.yaw
      const cy = Math.cos(sim.yaw)
      const sy = Math.sin(sim.yaw)
      if (fighting) sim.gait = advanceGait(sim.gait, Math.hypot(x - sim.lastX, z - sim.lastZ), dt)
      sim.lastX = x
      sim.lastZ = z

      // On the sand under its feet, not on a crest under its middle (its belly may brush that).
      const centre = groundFn(x, z)
      let sum = centre
      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? 1 : -1
        for (let leg = 0; leg < B.feet.length; leg++) {
          footStep(sim.step, sim.gait, leg, side)
          const lx = side * B.feet[leg][0]
          const lz = B.feet[leg][1] + sim.step.dz
          const g = groundFn(x + lx * cy + lz * sy, z - lx * sy + lz * cy)
          sim.footGround[s * B.feet.length + leg] = g
          sum += g
        }
      }
      const ground = Math.max(sum / (2 * B.feet.length + 1), centre - MAX_BELLY_DIP)
      root.position.y = ground + riseOffset(age, sinceDefeat)
      if (!sim.placed) {
        sim.placed = true
        sandBurst(x, centre, z, RISE_TRAUMA)
      }

      let n = 0
      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? 1 : -1
        for (let leg = 0; leg < B.hips.length; leg++) {
          const [hx, hy, hz] = B.hips[leg]
          const [fx, fz] = B.feet[leg]
          footStep(sim.step, sim.gait, leg, side)
          const lx = side * fx
          const lz = fz + sim.step.dz
          const fy = sim.footGround[s * B.feet.length + leg] - ground + sim.step.lift
          const kx = side * (hx + (fx - hx) * 0.55)
          const kz = hz + (lz - hz) * 0.55
          const ky = Math.max(hy, fy) + B.kneeRise
          setLimb(limbs, n++, side * hx, hy, hz, kx, ky, kz, B.femurRadius)
          setLimb(limbs, n++, kx, ky, kz, lx, fy, lz, B.tibiaRadius)
        }
      }

      const lunge = fighting ? lungeAmount(age) : 0
      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? 1 : -1
        const id = s === 0 ? 'claw-l' : 'claw-r'
        const yaw = side * B.clawYaw
        const cx = side * B.claw[0] + Math.sin(age * 1.1 + s) * 18
        const cyy = B.claw[1] + Math.sin(age * 1.7 + s) * 12 + Math.max(0, lunge) * 40
        const cz = B.claw[2] + Math.sin(age * 1.3 + s * 2) * 25 - Math.max(0, lunge) * 30
        const wx = cx - Math.sin(yaw) * B.wristBack
        const wz = cz - Math.cos(yaw) * B.wristBack
        const ex = side * B.elbow[0]
        const ey = B.elbow[1] + Math.sin(age * 1.7 + s) * 8
        const ez = B.elbow[2]
        setLimb(limbs, n++, side * B.shoulder[0], B.shoulder[1], B.shoulder[2], ex, ey, ez, B.armRadius)
        setLimb(limbs, n++, ex, ey, ez, wx, cyy, wz, B.armRadius * 0.85)
        const claw = parts.get(id)
        if (claw) {
          claw.position.set(cx, cyy, cz)
          claw.rotation.set(0, yaw, 0)
        }
        const finger = sim.fingers.get(id)
        if (finger) finger.rotation.y = -(0.15 + 0.45 * (0.5 + 0.5 * Math.sin(age * 2.4 + s * 1.7))) * (1 - Math.max(0, lunge))
      }
      limbs.instanceMatrix.needsUpdate = true
      // Its bounds change every frame; recomputed only when something asks (the e2e box).
      limbs.boundingBox = null

      let live = 0
      for (let i = 0; i < T.segments; i++) {
        if (parts.get(TAIL_IDS[i])?.visible) sim.liveTail[live++] = i
      }
      const pose = layTail(sim.tail, live, lunge, fighting ? Math.sin(age * 1.6) * T.sway : 0)
      for (let j = 0; j < live; j++) {
        const seg = parts.get(TAIL_IDS[sim.liveTail[j]])
        if (!seg) continue
        const th = pose.theta[j]
        seg.position.set(0, pose.y[j] + Math.cos(th) * T.segLen * 0.5, pose.z[j] + Math.sin(th) * T.segLen * 0.5)
        seg.rotation.set(th, 0, 0)
      }
      const stinger = parts.get('stinger')
      const th = pose.theta[live]
      if (stinger) {
        stinger.position.set(0, pose.y[live], pose.z[live])
        stinger.rotation.set(th, 0, 0)
      }
      if (fighting && lungeImpactBetween(sim.lastAge, age)) {
        const tz = pose.z[live] + Math.sin(th) * STINGER_REACH
        const tx = x + tz * sy
        const tzw = z + tz * cy
        sandBurst(tx, groundFn(tx, tzw), tzw, LUNGE_TRAUMA)
      }
      sim.lastAge = age
      if (isExposed(state, 'stinger')) SCORPION_STINGER_EXPOSED_MAT.emissiveIntensity = 2 + 0.8 * Math.sin(age * 7)

      if (!fighting && !sim.defeatBurst) {
        sim.defeatBurst = true
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2
          sandBurst(x + Math.cos(a) * 220, ground, z + Math.sin(a) * 220, DEFEAT_TRAUMA)
        }
      }
    },
    [aim, groundFn, sim],
  )

  const renderWeakPoint = useCallback(
    (w: WeakPointSpec, exposed: boolean) => {
      if (w.id === 'stinger') {
        return <mesh geometry={SCORPION_STINGER_GEO} material={exposed ? SCORPION_STINGER_EXPOSED_MAT : SCORPION_STINGER_MAT} />
      }
      if (w.id.startsWith('claw')) {
        return (
          // Mirrored, so its fixed finger is on the outside too.
          <group scale={w.id === 'claw-r' ? [-1, 1, 1] : [1, 1, 1]}>
            <mesh geometry={SCORPION_CLAW_GEO} material={SCORPION_SHELL_MAT} />
            <mesh
              ref={(m) => {
                if (m) sim.fingers.set(w.id, m)
                else sim.fingers.delete(w.id)
              }}
              position={SCORPION_FINGER_HINGE}
              geometry={SCORPION_FINGER_GEO}
              material={SCORPION_SHELL_MAT}
            />
          </group>
        )
      }
      const s = T.radii[Number(w.id.slice('tail-'.length))] / T.radii[0]
      return <mesh geometry={SCORPION_TAIL_SEGMENT_GEO} material={SCORPION_TAIL_MAT} scale={[s, 1, s]} />
    },
    [sim],
  )

  const body = (
    <>
      <mesh geometry={SCORPION_BODY_GEO} material={SCORPION_SHELL_MAT} />
      <mesh geometry={SCORPION_GLOW_GEO} material={SCORPION_GLOW_MAT} />
      <instancedMesh ref={limbsRef} args={[SCORPION_LIMB_GEO, SCORPION_LIMB_MAT, LIMB_COUNT]} frustumCulled={false} />
    </>
  )

  return (
    <BossBase
      {...props}
      spec={GIANT_SCORPION}
      move={move}
      body={body}
      renderWeakPoint={renderWeakPoint}
      exitSeconds={EXIT_SECONDS}
      deathStyle={SCORPION_SHARD_DEATH_STYLE}
    >
      <mesh ref={moundRef} geometry={SCORPION_MOUND_GEO} material={SCORPION_MOUND_MAT} visible={false} />
      <BossConfetti bossId={props.id} />
    </BossBase>
  )
}
