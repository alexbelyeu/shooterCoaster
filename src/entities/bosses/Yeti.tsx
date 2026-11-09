import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { useGameStore } from '@/store/useGameStore'
import { CAMERA_TRAUMA_EVENT } from '@/combat/screenShake'
import { registerCollisionTarget, unregisterCollisionTarget } from '@/combat/CollisionManager'
import type { EnemyKilledEvent } from '@/combat/hitFeedback'
import { getExplosionPool } from '@/effects/explosionPoolHandle'
import { SNOW_BURST_DEATH_STYLE, SNOWBALL_DEATH_STYLE, YETI_PART_DEATH_STYLE } from '@/effects/deathStyles'
import { buildTrackIndex } from '@/levels/environments/shared/trackClearance'
import { AURORA_DEFAULT_INTENSITY, AURORA_INTENSITY_EVENT } from '@/levels/environments/biomes/arctic/aurora'
import { BOSS_PROJECTILE_PREFIX, e2eBoss, isE2E } from '@/testing/e2eHook'
import { SNOWBALL_SPLAT_EVENT } from '@/ui/hud/SnowSplat'
import BossBase, { type BossFrame, type BossProps } from './BossBase'
import BossConfetti from './BossConfetti'
import { setLimb } from './bossLimbs'
import { currentPhase, isExposed, weakPointHp, type WeakPointSpec } from './bossModel'
import { YETI, YETI_SNOWBALL } from './bossSpecs'
import {
  SNOWBALL_GEO, SNOWBALL_MAT, YETI_BODY_GEO, YETI_CHEST_EXPOSED_MAT, YETI_CHEST_GEO, YETI_CHEST_MAT, YETI_FIST_GEO,
  YETI_FUR_MAT, YETI_HEAD_GEO, YETI_LIMB_GEO, YETI_MOUTH_GEO, YETI_MOUTH_OFFSET,
} from './bossAssets'
import { approachAngle, pickPerch, type Perch, type PerchInput } from './scorpionMotion'
import {
  YETI_BODY, YETI_PERCH, YETI_RISE, YETI_ROAM, YETI_THROW, THROW_S, chestRetracted, elbowPose, fistPose, isRoaring, lopeAt,
  needsRelocate, passedCamera, riseOffset, roarAmount, roarNowEpoch, snowballAt, throwArmAlive, throwSwing, timeToNextRoar,
  toppleAngle, toppleSink, type Lope, type Point3,
} from './yetiMotion'

const B = YETI_BODY
const FISTS = ['fist-l', 'fist-r'] as const
const FIST_SIDE = [1, -1] as const
const HEADING_TAU = 2.5
const TURN_TAU = 0.5
const AURORA_ROAR = 2.6
const AURORA_TELL = 2.2
const PUFF_EVERY_S = 0.5
const RISE_TRAUMA = [0.3, 450] as const
const LAND_TRAUMA = [0.12, 250] as const
const SPLAT_TRAUMA = [0.25, 300] as const
const FALL_TRAUMA = [0.7, 900] as const
const EXIT_SECONDS = YETI_RISE.toppleS + YETI_RISE.sinkS + 0.5

const _cam = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _to = new THREE.Vector3()
const _p = new THREE.Vector3()
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _one = new THREE.Vector3(1, 1, 1)

function snowBurst(x: number, y: number, z: number, trauma: readonly [number, number]) {
  getExplosionPool()?.explode(_p.set(x, y, z), SNOW_BURST_DEATH_STYLE)
  eventBus.emit(CAMERA_TRAUMA_EVENT, trauma[0], trauma[1])
}

interface Snowball {
  id: string
  live: boolean
  age: number
  prevS: number
  /** Passes the camera on its right (+1) or left (−1). */
  side: 1 | -1
  from: THREE.Vector3
  pos: THREE.Vector3
}

/** Antarctica finale: shoot its fists to stop the throws, then its chest while it roars; snowballs are bonus kills. */
export default function Yeti(props: BossProps) {
  const { id, track, groundFn, incoming, active } = props
  const camera = useThree((s) => s.camera)
  const limbsRef = useRef<THREE.InstancedMesh>(null)
  const headRef = useRef<THREE.Group>(null)
  const mouthRef = useRef<THREE.Mesh>(null)
  const ballsRef = useRef<THREE.InstancedMesh>(null)

  const input = useMemo<PerchInput>(
    () => ({ index: buildTrackIndex(track), avoid: [], camera: { x: 0, z: 0 }, forwardX: 0, forwardZ: -1 }),
    [track],
  )

  const sim = useMemo(
    () => ({
      heading: new THREE.Vector3(),
      headed: false,
      perch: { x: 0, z: 0, slot: 0, sign: 1 } as Perch,
      placed: false,
      anchorX: 0,
      anchorZ: 0,
      holdStart: 0,
      lopeStart: -1,
      fromX: 0,
      fromZ: 0,
      lope: { t: 0, lift: 0 } as Lope,
      yaw: 0,
      roarEpoch: 0,
      roaring: false,
      lastPhase: false,
      throwArm: -1,
      throwStart: 0,
      thrown: false,
      nextThrow: 0,
      nextArm: 0,
      nextSide: 1 as 1 | -1,
      throws: 0,
      tell: -1,
      nextPuff: 0,
      fell: false,
      fist: { x: 0, y: 0, z: 0 } as Point3,
      elbow: { x: 0, y: 0, z: 0 } as Point3,
      balls: Array.from({ length: YETI_THROW.pool }, (_, i): Snowball => ({
        id: `${BOSS_PROJECTILE_PREFIX}${id}:${i}`,
        live: false,
        age: 0,
        prevS: 0,
        side: 1,
        from: new THREE.Vector3(),
        pos: new THREE.Vector3(),
      })),
    }),
    [id],
  )

  const layBalls = useCallback(() => {
    const mesh = ballsRef.current
    if (!mesh) return
    let n = 0
    for (let i = 0; i < sim.balls.length; i++) {
      const b = sim.balls[i]
      if (!b.live) continue
      _q.setFromEuler(_e.set(b.age * (4 + i), b.age * (3 + i * 0.5), 0))
      mesh.setMatrixAt(n++, _m.compose(b.pos, _q, _one))
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
  }, [sim])

  const dropBall = useCallback((b: Snowball) => {
    b.live = false
    unregisterCollisionTarget(b.id)
  }, [])

  const shootBall = useCallback(
    (b: Snowball) => {
      if (!b.live) return
      dropBall(b)
      const store = useGameStore.getState()
      store.registerKill()
      store.addScore(YETI_SNOWBALL.score)
      const position = b.pos.clone()
      getExplosionPool()?.explode(position, SNOWBALL_DEATH_STYLE)
      const { combo } = useGameStore.getState()
      const event: EnemyKilledEvent = {
        position,
        combo: combo.count,
        multiplier: combo.multiplier,
        score: Math.round(YETI_SNOWBALL.score * combo.multiplier),
        sound: SNOWBALL_DEATH_STYLE.sound,
      }
      eventBus.emit('enemy:killed', event)
      layBalls()
    },
    [dropBall, layBalls],
  )

  const throwBall = useCallback(
    (from: THREE.Object3D) => {
      const b = sim.balls.find((s) => !s.live)
      if (!b) return
      from.getWorldPosition(b.from)
      b.pos.copy(b.from)
      b.live = true
      b.age = 0
      b.prevS = 0
      b.side = sim.nextSide
      sim.nextSide = -sim.nextSide as 1 | -1
      registerCollisionTarget({
        id: b.id,
        getPosition: () => b.pos,
        radiusSq: YETI_SNOWBALL.radius * YETI_SNOWBALL.radius,
        onHit: () => shootBall(b),
      })
    },
    [sim, shootBall],
  )

  useEffect(() => {
    if (isE2E) e2eBoss.projectiles = () => sim.balls.filter((b) => b.live).map((b) => b.pos)
    return () => {
      for (const b of sim.balls) if (b.live) dropBall(b)
      eventBus.emit(AURORA_INTENSITY_EVENT, AURORA_DEFAULT_INTENSITY)
      if (isE2E) e2eBoss.projectiles = null
    }
  }, [sim, dropBall])

  /** Heading smoothed through the loops, like the Scorpion's. */
  const aim = useCallback(
    (dt: number, repick: boolean) => {
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
      if (!repick) return true
      if (pickPerch(sim.perch, input, YETI_PERCH)) return true
      const [ahead, side] = YETI_PERCH.slots[0]
      sim.perch.x = _cam.x + sim.heading.x * ahead - sim.heading.z * side
      sim.perch.z = _cam.z + sim.heading.z * ahead + sim.heading.x * side
      return false
    },
    [camera, sim, input],
  )

  // The tell runs before BossBase's frame does.
  useFrame((_, delta) => {
    if (!incoming || active) return
    const { phase, timeScale } = useGameStore.getState()
    const dt = phase === 'playing' ? delta * timeScale : 0
    if (sim.tell < 0) {
      sim.tell = 0
      eventBus.emit(AURORA_INTENSITY_EVENT, AURORA_TELL)
    }
    sim.tell += dt
    aim(dt, true)
    if (sim.tell >= sim.nextPuff) {
      sim.nextPuff += PUFF_EVERY_S
      getExplosionPool()?.explode(_p.set(sim.perch.x, groundFn(sim.perch.x, sim.perch.z) + 40, sim.perch.z), SNOW_BURST_DEATH_STYLE)
    }
  })

  const move = useCallback(
    ({ root, parts, state, dt, age, sinceDefeat, retract }: BossFrame) => {
      const limbs = limbsRef.current
      const head = headRef.current
      const mouth = mouthRef.current
      if (!limbs || !head || !mouth) return
      const fighting = sinceDefeat < 0
      aim(dt, false)

      const lastPhase = currentPhase(state) === 1
      if (lastPhase && !sim.lastPhase) {
        sim.lastPhase = true
        sim.roarEpoch = roarNowEpoch(age)
        sim.throwArm = -1
      }
      const roarT = age - sim.roarEpoch
      const roaring = fighting && isRoaring(roarT)
      if (roaring !== sim.roaring) {
        sim.roaring = roaring
        eventBus.emit(AURORA_INTENSITY_EVENT, roaring ? AURORA_ROAR : AURORA_DEFAULT_INTENSITY)
      }
      retract('chest', chestRetracted(lastPhase, roarT))

      if (!sim.placed) {
        aim(0, true)
        sim.anchorX = sim.perch.x
        sim.anchorZ = sim.perch.z
        sim.holdStart = age
      } else if (fighting && sim.lopeStart < 0 && !roaring && sim.throwArm < 0 && timeToNextRoar(roarT) > YETI_ROAM.lopeS) {
        const dx = sim.anchorX - _cam.x
        const dz = sim.anchorZ - _cam.z
        const ahead = dx * sim.heading.x + dz * sim.heading.z
        const side = dz * sim.heading.x - dx * sim.heading.z
        if (needsRelocate(age - sim.holdStart, ahead, side)) {
          aim(0, true)
          sim.fromX = sim.anchorX
          sim.fromZ = sim.anchorZ
          sim.anchorX = sim.perch.x
          sim.anchorZ = sim.perch.z
          sim.lopeStart = age
        }
      }

      let x = sim.anchorX
      let z = sim.anchorZ
      let lift = 0
      if (sim.lopeStart >= 0) {
        lopeAt(sim.lope, age - sim.lopeStart)
        x = sim.fromX + (sim.anchorX - sim.fromX) * sim.lope.t
        z = sim.fromZ + (sim.anchorZ - sim.fromZ) * sim.lope.t
        lift = sim.lope.lift
        if (age - sim.lopeStart >= YETI_ROAM.lopeS) {
          sim.lopeStart = -1
          sim.holdStart = age
          snowBurst(x, groundFn(x, z), z, LAND_TRAUMA)
        }
      }

      const target = Math.atan2(_cam.x - x, _cam.z - z)
      sim.yaw = sim.placed ? approachAngle(sim.yaw, target, 1 - Math.exp(-dt / TURN_TAU)) : target
      const cy = Math.cos(sim.yaw)
      const sy = Math.sin(sim.yaw)
      // On the snow under its feet, not on a crest under its middle.
      const centre = groundFn(x, z)
      const ground = Math.max((centre + groundFn(x + 112 * cy, z - 112 * sy) + groundFn(x - 112 * cy, z + 112 * sy)) / 3, centre - 60)
      root.rotation.order = 'YXZ'
      root.rotation.y = sim.yaw
      root.rotation.x = toppleAngle(sinceDefeat)
      root.position.set(x, ground + riseOffset(age) + lift + toppleSink(sinceDefeat), z)
      if (!sim.placed) {
        sim.placed = true
        snowBurst(x, centre, z, RISE_TRAUMA)
      }

      if (fighting && sim.throwArm < 0 && !roaring && sim.lopeStart < 0 && age >= Math.max(sim.nextThrow, YETI_RISE.riseS)
        && sim.throws < YETI_SNOWBALL.max && timeToNextRoar(roarT) > THROW_S) {
        const arm = throwArmAlive(sim.nextArm, weakPointHp(state, FISTS[0]) > 0, weakPointHp(state, FISTS[1]) > 0)
        if (arm >= 0) {
          sim.throwArm = arm
          sim.throwStart = age
          sim.thrown = false
          sim.nextArm = 1 - arm
        }
      }
      if (sim.throwArm >= 0) {
        const u = age - sim.throwStart
        const fist = parts.get(FISTS[sim.throwArm])
        if (!fighting || weakPointHp(state, FISTS[sim.throwArm]) <= 0) sim.throwArm = -1
        else if (!sim.thrown && u >= YETI_THROW.windupS && fist) {
          sim.thrown = true
          sim.throws += 1
          throwBall(fist)
        }
        if (sim.throwArm >= 0 && u >= THROW_S) {
          sim.throwArm = -1
          sim.nextThrow = age + YETI_THROW.gapS
        }
      }

      const roar = fighting ? roarAmount(roarT) : 0
      head.rotation.x = -B.roarTilt * roar + Math.sin(age * 1.3) * 0.04
      mouth.scale.y = 0.3 + 1.5 * roar
      let n = 0
      for (let s = 0; s < 2; s++) {
        const side = FIST_SIDE[s]
        const swing = sim.throwArm === s ? throwSwing(age - sim.throwStart) : 0
        fistPose(sim.fist, side, roar, swing, age)
        elbowPose(sim.elbow, side, sim.fist)
        setLimb(limbs, n++, side * B.shoulder[0], B.shoulder[1], B.shoulder[2], sim.elbow.x, sim.elbow.y, sim.elbow.z, B.upperArmRadius)
        setLimb(limbs, n++, sim.elbow.x, sim.elbow.y, sim.elbow.z, sim.fist.x, sim.fist.y, sim.fist.z, B.forearmRadius)
        const fist = parts.get(FISTS[s])
        if (fist) {
          fist.position.set(sim.fist.x, sim.fist.y, sim.fist.z)
          fist.rotation.set(-1.2 * roar - 0.6 * Math.max(0, -swing), 0, 0)
        }
      }
      limbs.instanceMatrix.needsUpdate = true
      // Its bounds change every frame; recomputed only when something asks (the e2e box).
      limbs.boundingBox = null
      if (isExposed(state, 'chest')) YETI_CHEST_EXPOSED_MAT.emissiveIntensity = 2 + 0.8 * Math.sin(age * 7)

      // Aimed beside where the camera is now, not where it was at the throw, so each one passes the rider.
      _right.setFromMatrixColumn(camera.matrixWorld, 0)
      _up.setFromMatrixColumn(camera.matrixWorld, 1)
      for (const b of sim.balls) {
        if (!b.live) continue
        b.age += dt
        const s = b.age / YETI_THROW.flightS
        _to.copy(_cam).addScaledVector(_right, b.side * YETI_THROW.side).addScaledVector(_up, -YETI_THROW.drop)
        snowballAt(b.pos, b.from, _to, s)
        if (passedCamera(b.prevS, s)) {
          eventBus.emit(CAMERA_TRAUMA_EVENT, SPLAT_TRAUMA[0], SPLAT_TRAUMA[1])
          eventBus.emit(SNOWBALL_SPLAT_EVENT, b.side)
        }
        b.prevS = s
        if (s >= 1 + YETI_THROW.overshoot) dropBall(b)
      }
      layBalls()

      if (!fighting && !sim.fell && sinceDefeat >= YETI_RISE.toppleS) {
        sim.fell = true
        const back = 650 // its head and shoulders land behind it
        snowBurst(x - sy * back, groundFn(x - sy * back, z - cy * back), z - cy * back, FALL_TRAUMA)
        snowBurst(x, ground, z, FALL_TRAUMA)
      }
    },
    [aim, camera, groundFn, sim, throwBall, dropBall, layBalls],
  )

  const renderWeakPoint = useCallback((w: WeakPointSpec, exposed: boolean) => {
    if (w.id === 'chest') return <mesh geometry={YETI_CHEST_GEO} material={exposed ? YETI_CHEST_EXPOSED_MAT : YETI_CHEST_MAT} />
    return <mesh geometry={YETI_FIST_GEO} material={YETI_FUR_MAT} scale={w.id === 'fist-r' ? [-1, 1, 1] : [1, 1, 1]} />
  }, [])

  const body = (
    <>
      <mesh geometry={YETI_BODY_GEO} material={YETI_FUR_MAT} />
      <group ref={headRef} position={[...B.head]}>
        <mesh geometry={YETI_HEAD_GEO} material={YETI_FUR_MAT} />
        <mesh ref={mouthRef} geometry={YETI_MOUTH_GEO} material={YETI_FUR_MAT} position={YETI_MOUTH_OFFSET} />
      </group>
      <instancedMesh ref={limbsRef} args={[YETI_LIMB_GEO, YETI_FUR_MAT, 4]} frustumCulled={false} />
    </>
  )

  return (
    <BossBase
      {...props}
      spec={YETI}
      move={move}
      body={body}
      renderWeakPoint={renderWeakPoint}
      exitSeconds={EXIT_SECONDS}
      deathStyle={YETI_PART_DEATH_STYLE}
    >
      <instancedMesh ref={ballsRef} args={[SNOWBALL_GEO, SNOWBALL_MAT, YETI_THROW.pool]} visible={active} frustumCulled={false} count={0} />
      <BossConfetti bossId={props.id} />
    </BossBase>
  )
}
