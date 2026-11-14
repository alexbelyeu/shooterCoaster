import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { gameClockStep } from '@/core/gameClock'
import { CAMERA_TRAUMA_EVENT } from '@/combat/screenShake'
import { placeSound, sfx } from '@/audio/sfx'
import { getExplosionPool } from '@/effects/explosionPoolHandle'
import { MEDUSA_CHALK_BURST_DEATH_STYLE, MEDUSA_SNAKE_DEATH_STYLE } from '@/effects/deathStyles'
import { GYM_SCALE, STAR } from '@/levels/environments/biomes/gym/blockout'
import BossBase, { type BossFrame, type BossProps } from './BossBase'
import BossConfetti from './BossConfetti'
import { currentPhase, weakPointHp, type WeakPointSpec } from './bossModel'
import { MEDUSA } from './bossSpecs'
import {
  MEDUSA_BODY_GEO, MEDUSA_CROWN_HEAD_GEO, MEDUSA_CROWN_SNAKE_COLOR, MEDUSA_HAIR_GEO, MEDUSA_HAIR_MAT, MEDUSA_HUB_GEO, MEDUSA_HUB_MAT,
  MEDUSA_JEWEL_GEO, MEDUSA_JEWEL_MAT, MEDUSA_JEWEL_OFFSET, MEDUSA_SKIN_MAT, MEDUSA_SNAKE_BEAD_GEO, MEDUSA_SNAKE_COLORS,
  MEDUSA_SNAKE_HEAD_GEO, MEDUSA_SNAKE_HEAD_MAT, MEDUSA_SNAKE_MAT, MEDUSA_STAR_GLOW_GEO, MEDUSA_STAR_GLOW_MAT,
} from './bossAssets'
import {
  MEDUSA_DEFEAT, MEDUSA_RISE, SNAKE, SNAKE_SLOTS, MEDUSA_HUB, bodyPlacement, defeatSink, laughShake, laySnake, smooth01, yawToward,
  snakeLength, snakeRadius, strikeLandsBetween,
} from './medusaMotion'

const N = SNAKE.segments
const BEADS = SNAKE_SLOTS.length * N
const TELL_SECONDS = MEDUSA.tell.seconds
/** Phase 0's snakes uncoil as she finishes rising. */
const FIRST_SNAKES_AT = MEDUSA_RISE.riseS * 0.5
const CROWN_HEAD_SCALE = 1.5
/** A snake becomes a target once it is this far out of her curls. */
const SNAKE_TARGET_GROWN = 0.8
const LEAN_TAU = 0.35
const STAR_RADIUS = STAR.radius * GYM_SCALE
const HUB_RADIUS = 34
const RISE_TRAUMA = [0.35, 500] as const
const STRIKE_TRAUMA = [0.1, 160] as const
const DEFEAT_TRAUMA = [0.6, 900] as const
const EXIT_SECONDS = MEDUSA_DEFEAT.laughS + MEDUSA_DEFEAT.sinkS + 0.6

/** The star's front at its hub (world), and the way it faces. */
const HUB = new THREE.Vector3(...MEDUSA_HUB)
const FACING = new THREE.Vector3(STAR.facing.x, 0, STAR.facing.z).normalize()
const FACING_YAW = Math.atan2(FACING.x, FACING.z)

const STAR_GOLD = MEDUSA_STAR_GLOW_MAT.color.clone()
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _s = new THREE.Vector3()
const _cam = new THREE.Vector3()
const _camLocal = new THREE.Vector3()
const _p = new THREE.Vector3()
const _dir: [number, number, number] = [0, 0, 1]
const _place = { y: 0, z: 0, scale: 1, pitch: 0 }

/** Climbing Gym finale: she rises out of the Starr; shoot the snakes in her curls, four, four more, then the crown snake. */
export default function Medusa(props: BossProps) {
  const { incoming, active } = props
  const beadsRef = useRef<THREE.InstancedMesh>(null)
  const starRef = useRef<THREE.Group>(null)
  const starSpinRef = useRef<THREE.Group>(null)
  const hubRef = useRef<THREE.Mesh>(null)
  const heads = useRef(new Map<string, THREE.Group>()).current
  const points = useMemo(() => SNAKE_SLOTS.map(() => new Float32Array((N + 1) * 3)), [])

  const [tellStep] = useState(gameClockStep)
  const sim = useMemo(
    () => ({
      tell: -1,
      placed: false,
      phaseAt: [FIRST_SNAKES_AT, null, null] as (number | null)[],
      lean: 0,
      spin: 0,
      burst: false,
    }),
    [],
  )

  useEffect(() => {
    const beads = beadsRef.current
    if (!beads) return
    const color = new THREE.Color()
    SNAKE_SLOTS.forEach((s, i) => {
      color.set(s.phase === 2 ? MEDUSA_CROWN_SNAKE_COLOR : MEDUSA_SNAKE_COLORS[i % MEDUSA_SNAKE_COLORS.length])
      for (let k = 0; k < N; k++) {
        beads.setColorAt(i * N + k, color)
        beads.setMatrixAt(i * N + k, ZERO)
      }
    })
    beads.instanceMatrix.needsUpdate = true
    if (beads.instanceColor) beads.instanceColor.needsUpdate = true
  }, [])

  useEffect(
    () => () => {
      MEDUSA_STAR_GLOW_MAT.opacity = 0
      MEDUSA_HUB_MAT.opacity = 0
      MEDUSA_JEWEL_MAT.emissiveIntensity = 1.6
    },
    [],
  )

  /** The star outline (glow 0..1, turned by `spin`) and the hub's opening (0..1), in world space. */
  const showStar = useCallback((glow: number, open: number, flash: number) => {
    const star = starRef.current
    const hub = hubRef.current
    if (!star || !hub) return
    star.visible = glow > 0.01 || open > 0.01
    MEDUSA_STAR_GLOW_MAT.opacity = Math.min(1, glow)
    MEDUSA_STAR_GLOW_MAT.color.copy(STAR_GOLD).multiplyScalar(1 + 1.5 * flash)
    MEDUSA_HUB_MAT.opacity = Math.min(1, open) * 0.85
    hub.scale.setScalar(Math.max(0.001, HUB_RADIUS * open))
    if (starSpinRef.current) starSpinRef.current.rotation.z = sim.spin
  }, [sim])

  // The tell: the star's points glow and turn, its hub opens. Before BossBase's frame, on game time.
  useFrame(() => {
    if (!incoming || active) return
    const dt = tellStep()
    if (sim.tell < 0) sim.tell = 0
    sim.tell += dt
    const k = smooth01(sim.tell / TELL_SECONDS)
    sim.spin += dt * (0.6 + 2.4 * k)
    showStar(k, k, 0)
  })

  const move = useCallback(
    ({ root, parts, camera, state, dt, age, sinceDefeat, retract }: BossFrame) => {
      const fighting = sinceDefeat < 0
      const phase = currentPhase(state)
      if (phase > 0 && sim.phaseAt[phase] === null) sim.phaseAt[phase] = age
      const leanTarget = sim.phaseAt[1] !== null ? 1 : 0
      sim.lean += (leanTarget - sim.lean) * (1 - Math.exp(-dt / LEAN_TAU))

      // Rise out of the hub, lean out in phase 2, laugh and sink back on defeat; turn a little towards the rider.
      bodyPlacement(age, sim.lean, sinceDefeat, _place)
      camera.getWorldPosition(_cam)
      _p.subVectors(_cam, HUB)
      const yaw = yawToward(_p.x * FACING.z - _p.z * FACING.x, _p.x * FACING.x + _p.z * FACING.z)
      const shake = laughShake(sinceDefeat)
      root.rotation.order = 'YXZ'
      root.rotation.set(_place.pitch + shake * 0.03, FACING_YAW + yaw, shake * 0.04)
      root.scale.setScalar(_place.scale)
      root.position.copy(HUB).addScaledVector(FACING, _place.z)
      root.position.y += _place.y + Math.abs(shake) * 4
      root.updateMatrixWorld()
      if (!sim.placed) {
        sim.placed = true
        // Under her chest, where the star's lower points are, so the cloud never hides her face.
        getExplosionPool()?.explode(_p.copy(HUB).addScaledVector(FACING, 40).setY(HUB.y - 100), MEDUSA_CHALK_BURST_DEATH_STYLE)
        eventBus.emit(CAMERA_TRAUMA_EVENT, RISE_TRAUMA[0], RISE_TRAUMA[1])
      }

      // The star: its tell's glow fades as she rises; on defeat it spins and flashes while she sinks into the hub.
      const sunk = defeatSink(sinceDefeat)
      sim.spin += dt * (fighting ? 0.6 : 9)
      const fade = sim.tell < 0 ? 0 : 1 - smooth01(age / MEDUSA_RISE.riseS)
      const defeatGlow = fighting ? 0 : 1 - smooth01((sinceDefeat - MEDUSA_DEFEAT.laughS - MEDUSA_DEFEAT.sinkS) / 0.5)
      const flash = fighting ? 0 : 0.5 + 0.5 * Math.sin(sinceDefeat * 24)
      showStar(Math.max(fade, defeatGlow), Math.max(fade, fighting ? 0 : sunk * defeatGlow), flash)
      if (!fighting && !sim.burst) {
        sim.burst = true
        for (const y of [40, -60, 140]) getExplosionPool()?.explode(_p.set(0, y, 30).applyMatrix4(root.matrixWorld), MEDUSA_CHALK_BURST_DEATH_STYLE)
        eventBus.emit(CAMERA_TRAUMA_EVENT, DEFEAT_TRAUMA[0], DEFEAT_TRAUMA[1])
      }

      // The jewel glints now and then.
      MEDUSA_JEWEL_MAT.emissiveIntensity = 1.4 + 2.2 * Math.max(0, Math.sin(age * 2.3)) ** 8

      // The camera, root-local: what the snakes strike at.
      _camLocal.copy(_cam)
      root.worldToLocal(_camLocal)
      const beads = beadsRef.current
      let hissed = false
      for (let i = 0; i < SNAKE_SLOTS.length; i++) {
        const s = SNAKE_SLOTS[i]
        const w = MEDUSA.weakPoints[i]
        const alive = weakPointHp(state, w.id) > 0
        const grown = alive ? snakeLength(s, s.phase <= phase ? sim.phaseAt[s.phase] : null, age, true) : SNAKE.stub * (1 - sunk)
        // Still uncoiling inside her curls: not a target yet.
        retract(w.id, fighting && alive && s.phase === phase && grown < SNAKE_TARGET_GROWN)
        _b.set(_camLocal.x - s.root[0], _camLocal.y - s.root[1], _camLocal.z - s.root[2]).normalize()
        _dir[0] = _b.x
        _dir[1] = _b.y
        _dir[2] = _b.z
        const p = points[i]
        laySnake(s, age, grown, alive, _dir, p)
        // A bead per segment, stretched over it and overlapping the next.
        for (let k = 0; beads && k < N; k++) {
          if (grown < 0.02) {
            beads.setMatrixAt(i * N + k, ZERO)
            continue
          }
          _a.set(p[k * 3], p[k * 3 + 1], p[k * 3 + 2])
          _b.set(p[k * 3 + 3], p[k * 3 + 4], p[k * 3 + 5])
          _s.addVectors(_a, _b).multiplyScalar(0.5)
          _b.sub(_a)
          const len = _b.length()
          if (len > 1e-6) _q.setFromUnitVectors(Y_AXIS, _b.divideScalar(len))
          const r = snakeRadius(s, k + 0.5) * Math.min(1, 0.4 + grown)
          beads.setMatrixAt(i * N + k, _m.compose(_s, _q, _p.set(r, len * 0.62 + r * 0.2, r)))
        }
        const part = parts.get(w.id)
        const head = heads.get(w.id)
        if (!part || !head) continue
        part.position.set(p[N * 3], p[N * 3 + 1], p[N * 3 + 2])
        _b.set(p[N * 3] - p[N * 3 - 3], p[N * 3 + 1] - p[N * 3 - 2], p[N * 3 + 2] - p[N * 3 - 1])
        if (_b.lengthSq() > 1e-6) part.quaternion.setFromUnitVectors(Z_AXIS, _b.normalize())
        head.scale.setScalar((s.phase === 2 ? CROWN_HEAD_SCALE : 1) * Math.max(0.001, Math.min(1, grown * 1.5)))
        if (fighting && alive && grown > 0.95 && !hissed && strikeLandsBetween(s, age - dt, age)) {
          hissed = true
          eventBus.emit(CAMERA_TRAUMA_EVENT, STRIKE_TRAUMA[0], STRIKE_TRAUMA[1])
          sfx().kill(0, 'hiss', placeSound(part.getWorldPosition(_p)))
        }
      }
      if (beads) beads.instanceMatrix.needsUpdate = true
    },
    [sim, points, heads, showStar],
  )

  const renderWeakPoint = useCallback(
    (w: WeakPointSpec) => (
      <group ref={(g) => { if (g) heads.set(w.id, g); else heads.delete(w.id) }} scale={0.001}>
        <mesh geometry={w.id === 'crown' ? MEDUSA_CROWN_HEAD_GEO : MEDUSA_SNAKE_HEAD_GEO} material={MEDUSA_SNAKE_HEAD_MAT} />
      </group>
    ),
    [heads],
  )

  const body = (
    <>
      <mesh geometry={MEDUSA_BODY_GEO} material={MEDUSA_SKIN_MAT} />
      <mesh geometry={MEDUSA_HAIR_GEO} material={MEDUSA_HAIR_MAT} />
      <mesh geometry={MEDUSA_JEWEL_GEO} material={MEDUSA_JEWEL_MAT} position={MEDUSA_JEWEL_OFFSET} />
    </>
  )

  return (
    <BossBase
      {...props}
      spec={MEDUSA}
      move={move}
      body={body}
      rigging={<instancedMesh ref={beadsRef} args={[MEDUSA_SNAKE_BEAD_GEO, MEDUSA_SNAKE_MAT, BEADS]} frustumCulled={false} />}
      renderWeakPoint={renderWeakPoint}
      exitSeconds={EXIT_SECONDS}
      deathStyle={MEDUSA_SNAKE_DEATH_STYLE}
    >
      <group ref={starRef} position={HUB} rotation={[0, FACING_YAW, 0]} visible={false}>
        <group ref={starSpinRef}>
          <mesh geometry={MEDUSA_STAR_GLOW_GEO} material={MEDUSA_STAR_GLOW_MAT} scale={STAR_RADIUS} />
        </group>
        <mesh ref={hubRef} geometry={MEDUSA_HUB_GEO} material={MEDUSA_HUB_MAT} position={[0, 0, 1]} />
      </group>
      <BossConfetti bossId={props.id} />
    </BossBase>
  )
}
