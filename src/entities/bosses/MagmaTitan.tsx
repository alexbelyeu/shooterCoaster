import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { gameClockStep } from '@/core/gameClock'
import { CAMERA_TRAUMA_EVENT } from '@/combat/screenShake'
import { getExplosionPool } from '@/effects/explosionPoolHandle'
import { LAVA_BURST_DEATH_STYLE, TITAN_BREAK_DEATH_STYLE, TITAN_PART_DEATH_STYLE } from '@/effects/deathStyles'
import { buildTrackIndex } from '@/levels/environments/shared/trackClearance'
import { RIVER_CONFIGS, RIVER_SEGMENTS, riverRow } from '@/levels/environments/biomes/volcanic/lavaRiverPaths'
import { VOLCANO, VOLCANO_SITE } from '@/levels/environments/volcanoGeometry'
import BossBase, { type BossFrame, type BossProps } from './BossBase'
import BossConfetti from './BossConfetti'
import { currentPhase, hpFraction, weakPointHp, type WeakPointSpec } from './bossModel'
import { MAGMA_TITAN } from './bossSpecs'
import {
  TITAN_ARM_GEO, TITAN_BODY_GEO, TITAN_CRACK_UNIFORMS, TITAN_CROWN_GEO, TITAN_HEAD_GEO, TITAN_HEART_OPEN_GEO,
  TITAN_HEART_SHUT_GEO, TITAN_LEG_GEO, TITAN_OBSIDIAN_MAT, TITAN_VENT_GEO,
} from './bossAssets'
import { approachAngle, pickPerch, type Perch, type PerchInput } from './scorpionMotion'
import {
  TITAN_BODY, TITAN_DEFEAT, TITAN_PERCH, TITAN_RISE, TITAN_WADE, beatNowEpoch, crackGlow, defeatHeat, defeatSink,
  heartOpenAmount, isHeartOpen, needsWade, pickRiverSpot, poundAmount, poundBetween, riseOffset, strideAngle, wadeStep,
  type Point2,
} from './titanMotion'

const B = TITAN_BODY
const VENTS = ['vent-l', 'vent-r'] as const
const SIDES = [1, -1] as const
const HIP: [number, number, number] = [170, 420, 0]
const HEADING_TAU = 2.5
const TURN_TAU = 0.6
const GLOW_TAU = 0.25
const BUBBLE_EVERY_S = 0.4
/** The final eruption's fog closes in only this far (an eruption wave's goes to 200), so the Titan stays in view. */
const ERUPTION_FOG_FAR = 3500
const RISE_TRAUMA = [0.5, 700] as const
const POUND_TRAUMA = [0.18, 220] as const
const BREAK_TRAUMA = [0.8, 1100] as const
const BURST_AT = TITAN_DEFEAT.darkS + TITAN_DEFEAT.flashS
const EXIT_SECONDS = BURST_AT + TITAN_DEFEAT.sinkS + 0.4
/** Where its break bursts, in its local frame: chest, shoulders, head. */
const BREAK_POINTS: readonly (readonly [number, number, number])[] = [[0, 820, 60], [300, 1050, 0], [-300, 1050, 0], [0, 1200, 30]]

/** Every 4th row of every lava river: the spots it can climb out of. */
const RIVER_SPOTS: readonly Point2[] = RIVER_CONFIGS.flatMap((cfg) =>
  Array.from({ length: RIVER_SEGMENTS / 4 + 1 }, (_, i) => {
    const row = riverRow(cfg, i * 4)
    return { x: row.cx, z: row.cz }
  }),
)

const _cam = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _p = new THREE.Vector3()

function lavaBurst(x: number, y: number, z: number, trauma?: readonly [number, number]) {
  getExplosionPool()?.explode(_p.set(x, y, z), LAVA_BURST_DEATH_STYLE)
  if (trauma) eventBus.emit(CAMERA_TRAUMA_EVENT, trauma[0], trauma[1])
}

export default function MagmaTitan(props: BossProps) {
  const { track, groundFn, incoming, active } = props
  const camera = useThree((s) => s.camera)
  const armRefs = useRef<(THREE.Group | null)[]>([null, null])
  const legRefs = useRef<(THREE.Group | null)[]>([null, null])

  const input = useMemo<PerchInput>(
    () => ({
      index: buildTrackIndex(track),
      avoid: [{ x: VOLCANO_SITE.x, z: VOLCANO_SITE.z, r: VOLCANO.baseRadius }],
      camera: { x: 0, z: 0 },
      forwardX: 0,
      forwardZ: -1,
    }),
    [track],
  )

  const [tellStep] = useState(gameClockStep)
  const sim = useMemo(
    () => ({
      heading: new THREE.Vector3(),
      headed: false,
      spot: { x: 0, z: 0 } as Point2,
      perch: { x: 0, z: 0, slot: 0, sign: 1 } as Perch,
      pos: { x: 0, z: 0 } as Point2,
      placed: false,
      wading: false,
      waded: 0,
      holdStart: 0,
      yaw: 0,
      beatEpoch: 0,
      ventsGone: false,
      glow: 0,
      burst: false,
      tell: -1,
      nextBubble: 0,
    }),
    [],
  )

  useEffect(
    () => () => {
      TITAN_CRACK_UNIFORMS.uGlow.value = 0
      TITAN_CRACK_UNIFORMS.uHeat.value = 1
    },
    [],
  )

  /** Heading smoothed through the loops, like the Yeti's; `repick` moves `sim.perch` to a clear slot ahead. */
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
      if (!repick || pickPerch(sim.perch, input, TITAN_PERCH)) return
      const [ahead, side] = TITAN_PERCH.slots[0]
      sim.perch.x = _cam.x + sim.heading.x * ahead - sim.heading.z * side
      sim.perch.z = _cam.z + sim.heading.z * ahead + sim.heading.x * side
    },
    [camera, sim, input],
  )

  /** A lava river ahead if one is in view, else the first clear slot. */
  const pickSpot = useCallback(() => {
    if (pickRiverSpot(sim.spot, input, RIVER_SPOTS)) return
    aim(0, true)
    sim.spot.x = sim.perch.x
    sim.spot.z = sim.perch.z
  }, [sim, input, aim])

  // The tell: the final eruption, and the lava heaving where it will climb out. Runs before BossBase's frame does.
  useFrame(() => {
    if (!incoming || active) return
    // Game time, like BossBase: a pause or the end of the run holds it, slow-mo slows it.
    const dt = tellStep()
    if (sim.tell < 0) {
      sim.tell = 0
      eventBus.emit('eruption:start', ERUPTION_FOG_FAR)
    }
    sim.tell += dt
    aim(dt, false)
    pickSpot()
    if (sim.tell >= sim.nextBubble) {
      sim.nextBubble += BUBBLE_EVERY_S
      lavaBurst(sim.spot.x, groundFn(sim.spot.x, sim.spot.z) + 30, sim.spot.z)
    }
  })

  const move = useCallback(
    ({ root, state, dt, age, sinceDefeat, retract }: BossFrame) => {
      const fighting = sinceDefeat < 0
      aim(dt, false)

      if (!sim.placed) {
        if (sim.tell < 0) pickSpot() // summoned without a tell
        sim.pos.x = sim.spot.x
        sim.pos.z = sim.spot.z
        sim.holdStart = age
      }

      // The heart opens on every beat; it beats at once when its vents are gone.
      if (!sim.ventsGone && VENTS.every((v) => weakPointHp(state, v) <= 0)) {
        sim.ventsGone = true
        if (currentPhase(state) === 0) sim.beatEpoch = beatNowEpoch(age)
      }
      const beatT = age - sim.beatEpoch
      retract('heart', fighting && weakPointHp(state, 'heart') > 0 && !isHeartOpen(beatT))
      const pound = fighting ? poundAmount(beatT) : 0
      const open = fighting ? heartOpenAmount(beatT) : 0
      if (fighting && poundBetween(beatT - dt, beatT)) eventBus.emit(CAMERA_TRAUMA_EVENT, POUND_TRAUMA[0], POUND_TRAUMA[1])

      // Wades after the rider between beats, once it has climbed out.
      if (fighting && sim.placed && !sim.wading && age >= TITAN_RISE.riseS && open === 0) {
        const dx = sim.pos.x - _cam.x
        const dz = sim.pos.z - _cam.z
        const ahead = dx * sim.heading.x + dz * sim.heading.z
        const side = dz * sim.heading.x - dx * sim.heading.z
        if (needsWade(age - sim.holdStart, ahead, side)) {
          aim(0, true)
          sim.wading = true
        }
      }
      if (sim.wading) {
        const x0 = sim.pos.x
        const z0 = sim.pos.z
        const arrived = !fighting || wadeStep(sim.pos, sim.perch, dt)
        sim.waded += Math.hypot(sim.pos.x - x0, sim.pos.z - z0)
        if (arrived) {
          sim.wading = false
          sim.holdStart = age
        }
      }

      const { x, z } = sim.pos
      const target = Math.atan2(_cam.x - x, _cam.z - z)
      sim.yaw = sim.placed ? approachAngle(sim.yaw, target, 1 - Math.exp(-dt / TURN_TAU)) : target
      const stride = strideAngle(sim.waded)
      const walking = sim.wading ? 1 : 0
      root.rotation.order = 'YXZ'
      root.rotation.y = sim.yaw
      root.rotation.z = Math.sin(stride) * TITAN_WADE.sway * walking
      root.rotation.x = sinceDefeat < 0 ? 0 : -0.15 * Math.min(1, sinceDefeat / TITAN_DEFEAT.darkS)
      const bob = Math.abs(Math.sin(stride)) * TITAN_WADE.bob * walking
      root.position.set(x, groundFn(x, z) + riseOffset(age) + bob + defeatSink(sinceDefeat), z)
      if (!sim.placed) {
        sim.placed = true
        lavaBurst(x, groundFn(x, z) + 40, z, RISE_TRAUMA)
      }

      // Arms: hanging, swung in to pound the chest, then spread while the heart is open.
      for (let i = 0; i < 2; i++) {
        const side = SIDES[i]
        const arm = armRefs.current[i]
        if (arm) {
          arm.rotation.x = -1.25 * pound - 0.25 * open + Math.sin(stride + i * Math.PI) * 0.3 * walking
          arm.rotation.z = side * (0.12 + 0.55 * open * (1 - pound) - 0.7 * pound)
        }
        const leg = legRefs.current[i]
        if (leg) leg.rotation.x = Math.sin(stride + i * Math.PI) * 0.35 * walking
      }

      // Cracks heat up as its hp drops; on defeat it goes black, flashes and bursts into lava chunks.
      sim.glow += (crackGlow(hpFraction(state)) - sim.glow) * (1 - Math.exp(-dt / GLOW_TAU))
      TITAN_CRACK_UNIFORMS.uGlow.value = sim.glow
      TITAN_CRACK_UNIFORMS.uHeat.value = defeatHeat(sinceDefeat)
      if (!fighting && !sim.burst && sinceDefeat >= BURST_AT) {
        sim.burst = true
        for (const p of BREAK_POINTS) getExplosionPool()?.explode(_p.set(p[0], p[1], p[2]).applyMatrix4(root.matrixWorld), TITAN_BREAK_DEATH_STYLE)
        eventBus.emit(CAMERA_TRAUMA_EVENT, BREAK_TRAUMA[0], BREAK_TRAUMA[1])
      }
    },
    [aim, pickSpot, groundFn, sim],
  )

  const renderWeakPoint = useCallback((w: WeakPointSpec, exposed: boolean) => {
    if (w.id === 'heart') return <mesh geometry={exposed ? TITAN_HEART_OPEN_GEO : TITAN_HEART_SHUT_GEO} material={TITAN_OBSIDIAN_MAT} />
    if (w.id === 'crown') return <mesh geometry={TITAN_CROWN_GEO} material={TITAN_OBSIDIAN_MAT} />
    return <mesh geometry={TITAN_VENT_GEO} material={TITAN_OBSIDIAN_MAT} />
  }, [])

  const body = (
    <>
      <mesh geometry={TITAN_BODY_GEO} material={TITAN_OBSIDIAN_MAT} />
      <mesh geometry={TITAN_HEAD_GEO} material={TITAN_OBSIDIAN_MAT} position={[...B.head]} />
      {SIDES.map((side, i) => (
        <group key={`arm-${side}`} ref={(g) => { armRefs.current[i] = g }} position={[side * B.shoulder[0], B.shoulder[1], B.shoulder[2]]}>
          <mesh geometry={TITAN_ARM_GEO} material={TITAN_OBSIDIAN_MAT} />
        </group>
      ))}
      {SIDES.map((side, i) => (
        <group key={`leg-${side}`} ref={(g) => { legRefs.current[i] = g }} position={[side * HIP[0], HIP[1], HIP[2]]}>
          <mesh geometry={TITAN_LEG_GEO} material={TITAN_OBSIDIAN_MAT} />
        </group>
      ))}
    </>
  )

  return (
    <BossBase
      {...props}
      spec={MAGMA_TITAN}
      move={move}
      body={body}
      renderWeakPoint={renderWeakPoint}
      exitSeconds={EXIT_SECONDS}
      deathStyle={TITAN_PART_DEATH_STYLE}
    >
      <BossConfetti bossId={props.id} />
    </BossBase>
  )
}
