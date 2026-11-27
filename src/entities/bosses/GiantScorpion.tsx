import { useCallback, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { gameClockStep } from '@/core/gameClock'
import { CAMERA_TRAUMA_EVENT } from '@/combat/screenShake.hot'
import { sightClear, type HeightFunction } from '@/utils/terrainNoise'
import { getExplosionPool } from '@/effects/explosionPoolHandle'
import { BOSS_DEFEAT_DEATH_STYLE, SAND_BURST_DEATH_STYLE, SCORPION_SHARD_DEATH_STYLE } from '@/effects/deathStyles'
import { buildTrackIndex } from '@/levels/environments/shared/trackClearance'
import { desertObstacles, layoutDesert } from '@/levels/environments/biomes/desert/desertLayout'
import BossBase, { type BossFrame, type BossProps } from './BossBase'
import { setLimb } from './bossLimbs'
import { currentPhase, isExposed, type WeakPointSpec } from './bossModel'
import { GIANT_SCORPION } from './bossSpecs'
import {
  SCORPION_BODY_GEO, SCORPION_CLAW_GEO, SCORPION_FINGER_GEO, SCORPION_FINGER_HINGE, SCORPION_GLOW_GEO, SCORPION_GLOW_MAT,
  SCORPION_LIMB_GEO, SCORPION_LIMB_MAT, SCORPION_MOUND_GEO, SCORPION_MOUND_MAT, SCORPION_SHELL_MAT, SCORPION_STINGER_EXPOSED_MAT,
  SCORPION_STINGER_GEO, SCORPION_STINGER_MAT, SCORPION_TAIL_MAT, SCORPION_TAIL_SEGMENT_GEO,
} from './bossAssets'
import {
  SCORPION_BODY, SCORPION_RISE, SCORPION_TAIL, advanceGait, approachAngle, createTailPose, faceYaw, firstSlot, footStep, layTail,
  lungeAmount, lungeImpactBetween, PERCH, scorpionPartShut, perchBehind, pickPerch, pickSeenPerch, riseOffset, leadLook, type FootStep, type Perch, type PerchInput,
} from './scorpionMotion.hot'
import { aimAtRider } from './bossAim.hot'

const B = SCORPION_BODY
const T = SCORPION_TAIL
const LIMB_COUNT = 20
const TAIL_IDS = Array.from({ length: T.segments }, (_, i) => `tail-${i}`)
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

const _cam = new THREE.Vector3()
const _p = new THREE.Vector3()
const _seen = new THREE.Vector3()

/** A perch it can burst out on: its claws and its raised stinger both well inside the rider's frame as it looks now, no dune
 * between. Near slots put a tail ~480 tall over the top of the frame, and a lift's pitch puts the near sand under it (#937). */
const SEEN_NDC = 0.75
const CLAW_HEIGHT = 80
const STINGER_HEIGHT = 480
/** No weak point in the frame this long, it burrows and bursts out again in it. */
const BURROW_AFTER_S = 0.5
const WEAK_POINT_NDC = 0.9
/** Its sight line to the rider, sampled every `SIGHT_STEP` and clear of the sand by `SIGHT_MARGIN`: sixteen samples
 * and none spare stepped over the crests of dunes the terrain's triangles drew over it (#1059: a perch at ~1500 seen by
 * it and hidden to the rider, for 2 s at a time on level 2's final turn). */
const SIGHT_STEP = 25
const SIGHT_SAMPLES_MAX = 100
const SIGHT_MARGIN = 30

function pointInFrame(camera: THREE.Camera, groundFn: HeightFunction, x: number, y: number, z: number, ndc: number): boolean {
  _seen.set(x, y, z).project(camera)
  if (!(_seen.z < 1 && Math.abs(_seen.x) < ndc && Math.abs(_seen.y) < ndc)) return false
  const samples = Math.min(SIGHT_SAMPLES_MAX, Math.max(16, Math.ceil(Math.hypot(x - _cam.x, z - _cam.z) / SIGHT_STEP)))
  return sightClear(groundFn, _cam.x, _cam.y, _cam.z, x, y, z, samples, SIGHT_MARGIN)
}

function inFrame(camera: THREE.Camera, groundFn: HeightFunction, x: number, z: number): boolean {
  const ground = groundFn(x, z)
  return pointInFrame(camera, groundFn, x, ground + CLAW_HEIGHT, z, SEEN_NDC) && pointInFrame(camera, groundFn, x, ground + STINGER_HEIGHT, z, SEEN_NDC)
}

const _wp = new THREE.Vector3()

/**
 * One of its live, open weak points of this phase inside the rider's frame, no dune between: what the rider can shoot
 * (#937). Not one shut between strikes (#1059): a raised tail over a dune with the open claws behind it is a fight the
 * rider can't touch until the next strike.
 */
function weakPointSeen(camera: THREE.Camera, groundFn: HeightFunction, frame: BossFrame): boolean {
  const { parts, state, age } = frame
  // By index, not `for…of parts`: that allocates an iterator and an entry array per weak point every frame (hard rule 8).
  const wps = state.spec.weakPoints
  const phase = currentPhase(state)
  for (let i = 0; i < wps.length; i++) {
    if (state.hp[i] <= 0 || wps[i].phase !== phase || scorpionPartShut(wps, state.hp, i, age)) continue
    const part = parts.get(wps[i].id)
    if (!part) continue
    part.getWorldPosition(_wp)
    if (pointInFrame(camera, groundFn, _wp.x, _wp.y, _wp.z, WEAK_POINT_NDC)) return true
  }
  return false
}

function sandBurst(x: number, y: number, z: number, trauma: readonly [number, number]) {
  getExplosionPool()?.explode(_p.set(x, y, z), SAND_BURST_DEATH_STYLE)
  eventBus.emit(CAMERA_TRAUMA_EVENT, trauma[0], trauma[1])
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
  /** The same slots, only those in the frame: for when its perch has left the frame. */
  const seenInput = useMemo<PerchInput>(
    () => ({ ...input, camera: { x: 0, z: 0 }, seen: (x, z) => inFrame(camera, groundFn, x, z) }),
    [input, camera, groundFn],
  )

  const [tellStep] = useState(gameClockStep)
  const sim = useMemo(
    () => ({
      heading: new THREE.Vector3(),
      headed: false,
      perch: { x: 0, z: 0, slot: 0, sign: 1 } as Perch,
      lead: { x: 0, z: -1, sign: 1 as 1 | -1 },
      perched: false,
      placed: false,
      /** Its age when it last burst out of the sand, and how long no weak point has been in the rider's frame. */
      riseFrom: 0,
      unseen: 0,
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

  /** Keeps a clear perch ahead of the rider; once it has one it stays put when every slot is blocked. True when it should
   * burrow and burst out again at a new perch: none of its exposed weak points has been in the rider's frame for
   * `BURROW_AFTER_S` and a slot in the frame, against the rider's look as it is now, is clear (#937: on level 2's final
   * stretch the view turns faster than it can scuttle after it, and a late fight spent the rest of the run out of sight). */
  const aim = useCallback(
    (dt: number, frame: BossFrame | null): boolean => {
      aimAtRider(camera, _cam, sim, input, dt)
      sim.unseen = !frame || !sim.placed || weakPointSeen(camera, groundFn, frame) ? 0 : sim.unseen + dt
      const risen = frame !== null && frame.age - sim.riseFrom > SCORPION_RISE.riseS
      if (risen && sim.unseen > BURROW_AFTER_S) {
        const lagX = sim.heading.x
        const lagZ = sim.heading.z
        sim.headed = false
        aimAtRider(camera, _cam, sim, input, 0)
        leadLook(sim.lead, lagX, lagZ, input.forwardX, input.forwardZ, sim.perch.sign)
        sim.perch.sign = sim.lead.sign
        seenInput.camera.x = input.camera.x
        seenInput.camera.z = input.camera.z
        seenInput.forwardX = sim.lead.x
        seenInput.forwardZ = sim.lead.z
        if (pickSeenPerch(sim.perch, seenInput)) return true
      }
      // A far slot (`SEEN_PERCH` only) is held: `pickPerch` doesn't know it and would pull the perch back under the frame.
      // Once the ride has passed it, it gives way to `pickPerch` rather than waiting on a seen slot that may not come.
      if (sim.perch.slot >= PERCH.slots.length && !perchBehind(sim.perch, input)) return false
      if (pickPerch(sim.perch, input)) sim.perched = true
      else if (!sim.perched) firstSlot(sim.perch, input)
      return false
    },
    [camera, sim, input, seenInput, groundFn],
  )

  // The tell runs before BossBase's frame does: the dune heaves where it will burst out.
  useFrame(() => {
    const mound = moundRef.current
    if (!mound) return
    // Game time, like BossBase: a pause or the end of the run holds it, slow-mo slows it.
    const dt = tellStep()
    if (incoming && !active) {
      if (sim.tell < 0) {
        sim.tell = 0
        eventBus.emit('scorpion:burrow')
      }
      sim.tell += dt
      aim(dt, null)
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
    (frame: BossFrame) => {
      const { root, parts, state, retract, dt, age, sinceDefeat } = frame
      const limbs = limbsRef.current
      if (!limbs) return
      const fighting = sinceDefeat < 0
      if (fighting && aim(dt, frame)) {
        sim.placed = false
        sim.riseFrom = age
        sim.unseen = 0
      }
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
      root.position.y = ground + riseOffset(age - sim.riseFrom, sinceDefeat)
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
      const wps = state.spec.weakPoints
      for (let i = 0; i < wps.length; i++) retract(wps[i].id, fighting && scorpionPartShut(wps, state.hp, i, age))
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
      defeatBurst={BOSS_DEFEAT_DEATH_STYLE}
      deathStyle={SCORPION_SHARD_DEATH_STYLE}
    >
      <mesh ref={moundRef} geometry={SCORPION_MOUND_GEO} material={SCORPION_MOUND_MAT} visible={false} />
    </BossBase>
  )
}
