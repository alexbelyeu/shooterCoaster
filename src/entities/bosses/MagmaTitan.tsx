import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { eventBus } from '@/core/EventBus'
import { gameClockStep } from '@/core/gameClock'
import { CAMERA_TRAUMA_EVENT } from '@/combat/screenShake.hot'
import { getExplosionPool } from '@/effects/explosionPoolHandle'
import { BOSS_DEFEAT_DEATH_STYLE, LAVA_BURST_DEATH_STYLE, TITAN_BREAK_DEATH_STYLE, TITAN_PART_DEATH_STYLE } from '@/effects/deathStyles'
import { buildTrackIndex } from '@/levels/environments/shared/trackClearance'
import { RIVER_CONFIGS, RIVER_SEGMENTS, riverRow } from '@/levels/environments/biomes/volcanic/lavaRiverPaths'
import { VOLCANO, VOLCANO_SITE } from '@/levels/environments/volcanoGeometry'
import BossBase, { type BossFrame, type BossProps } from './BossBase'
import { hpFraction, weakPointHp, type WeakPointSpec } from './bossModel'
import { MAGMA_TITAN } from './bossSpecs'
import {
  TITAN_ARM_GEO, TITAN_BODY_GEO, TITAN_CRACK_UNIFORMS, TITAN_CROWN_GEO, TITAN_HEAD_GEO, TITAN_HEART_OPEN_GEO,
  TITAN_HEART_SHUT_GEO, TITAN_LEG_GEO, TITAN_OBSIDIAN_MAT, TITAN_VENT_GEO,
} from './bossAssets'
import { approachAngle, firstSlot, pickPerch, type Perch, type PerchInput } from './scorpionMotion.hot'
import { aimAtRider, flatForward } from './bossAim.hot'
import { needsRelocate, windowAmount } from './bossCycle.hot'
import {
  TITAN_BEAT, TITAN_BODY, TITAN_BREAK_POINTS, TITAN_DEFEAT, TITAN_PERCH, TITAN_RISE, TITAN_WADE, crackGlow, defeatHeat, defeatSink, pickRiverSpot,
  poundAmount, poundBetween, riseOffset, strideAngle, titanShut, wadeStep, type Point2,
} from './titanMotion.hot'

const B = TITAN_BODY
const SIDES = [1, -1] as const
const WEAK_POINTS = MAGMA_TITAN.weakPoints
/** A shut vent sinks into its shoulder. */
const SHUT_SCALE: [number, number, number] = [0.8, 0.35, 0.8]
const HIP: [number, number, number] = [170, 420, 0]
const TURN_TAU = 0.6
const GLOW_TAU = 0.25
const BUBBLE_EVERY_S = 0.4
/** The final eruption's fog closes in only this far (an eruption wave's goes to 200), so the Titan stays in view. */
const FINAL_ERUPTION_FOG_FAR = 3500
const RISE_TRAUMA = [0.5, 700] as const
const POUND_TRAUMA = [0.18, 220] as const
const BREAK_TRAUMA = [0.8, 1100] as const
const BURST_AT = TITAN_DEFEAT.darkS + TITAN_DEFEAT.flashS
const EXIT_SECONDS = BURST_AT + TITAN_DEFEAT.sinkS + 0.4

/** Every 4th row of every lava river: the spots it can climb out of. */
const RIVER_SPOTS: readonly Point2[] = RIVER_CONFIGS.flatMap((cfg) =>
  Array.from({ length: RIVER_SEGMENTS / 4 + 1 }, (_, i) => {
    const row = riverRow(cfg, i * 4)
    return { x: row.cx, z: row.cz }
  }),
)

const _cam = new THREE.Vector3()
const _p = new THREE.Vector3()
const _view = new THREE.Vector3()
/** Seconds the risen Titan stays out of the rider's view before it sinks and climbs out ahead of it again. */
const RESURFACE_AWAY_S = 1
/**
 * The rider's view for that: `TITAN_WADE`'s bounds, but no wider than the frame (its 0.95 rad let the turntable and the
 * curve after it carry the Titan off screen for 2 s, #937). Still wider than every river spot (`RIVER_SPOT.maxOff`) and
 * perch slot, so a fresh pick is always in view.
 */
const RESURFACE_VIEW = { ...TITAN_WADE, maxOffAngle: 0.65 }

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
      riseFrom: 0,
      awayFor: 0,
      yaw: 0,
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

  /** `repick` moves `sim.perch` to a clear slot ahead. */
  const aim = useCallback(
    (dt: number, repick: boolean) => {
      aimAtRider(camera, _cam, sim, input, dt)
      if (repick && !pickPerch(sim.perch, input, TITAN_PERCH)) firstSlot(sim.perch, input, TITAN_PERCH)
    },
    [camera, sim, input],
  )

  /**
   * A lava river ahead if one is in view, else the first clear slot. Ahead of where the rider looks now, not the eased
   * heading the Titan turns by: level 5's tell runs through the turntable that turns the car round, and the eased
   * heading still looked sideways when it climbed out (#937).
   */
  const pickSpot = useCallback(() => {
    flatForward(camera, _view)
    input.forwardX = _view.x
    input.forwardZ = _view.z
    if (pickRiverSpot(sim.spot, input, RIVER_SPOTS)) return
    if (!pickPerch(sim.perch, input, TITAN_PERCH)) firstSlot(sim.perch, input, TITAN_PERCH)
    sim.spot.x = sim.perch.x
    sim.spot.z = sim.perch.z
  }, [camera, sim, input])

  /** Whether a spot is ahead of where the rider looks now, within `RESURFACE_VIEW`. */
  const inRiderView = useCallback(
    (x: number, z: number) => {
      flatForward(camera, _view)
      const dx = x - _cam.x
      const dz = z - _cam.z
      const ahead = dx * _view.x + dz * _view.z
      return !needsRelocate(RESURFACE_VIEW, 0, ahead, dz * _view.x - dx * _view.z)
    },
    [camera],
  )

  // The tell: the final eruption, and the lava heaving where it will climb out. Runs before BossBase's frame does.
  useFrame(() => {
    if (!incoming || active) return
    // Game time, like BossBase: a pause or the end of the run holds it, slow-mo slows it.
    const dt = tellStep()
    if (sim.tell < 0) {
      sim.tell = 0
      eventBus.emit('eruption:start', FINAL_ERUPTION_FOG_FAR)
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

      // Out of the rider's view (level 5's turntable turns the car round as it climbs out, #937): it sinks unseen and
      // climbs out of a river ahead of the new view, at once while it is still climbing out, else once it has been
      // out of view for `RESURFACE_AWAY_S`.
      const risen = age - sim.riseFrom >= TITAN_RISE.riseS
      const away = sim.placed && fighting && !inRiderView(sim.pos.x, sim.pos.z)
      sim.awayFor = away ? sim.awayFor + dt : 0
      const resurface = away && (!risen || sim.awayFor >= RESURFACE_AWAY_S)
      if (!sim.placed || resurface) {
        if (sim.tell < 0 || resurface) pickSpot() // summoned without a tell, or out of view
        sim.pos.x = sim.spot.x
        sim.pos.z = sim.spot.z
        sim.holdStart = age
        if (resurface) {
          sim.riseFrom = age
          sim.awayFor = 0
          sim.wading = false
          lavaBurst(sim.pos.x, groundFn(sim.pos.x, sim.pos.z) + 40, sim.pos.z)
        }
      }

      // Each weak point opens and shuts on the beat (`titanShut`).
      const heartLive = weakPointHp(state, 'heart') > 0
      for (let i = 0; i < WEAK_POINTS.length; i++) {
        const w = WEAK_POINTS[i].id
        retract(w, fighting && weakPointHp(state, w) > 0 && titanShut(w, age, heartLive))
      }
      const pound = fighting ? poundAmount(age) : 0
      const open = fighting ? windowAmount(TITAN_BEAT, age) : 0
      if (fighting && poundBetween(age - dt, age)) eventBus.emit(CAMERA_TRAUMA_EVENT, POUND_TRAUMA[0], POUND_TRAUMA[1])

      // Wades after the rider between beats, once it has climbed out.
      if (fighting && sim.placed && !sim.wading && risen && open === 0) {
        const dx = sim.pos.x - _cam.x
        const dz = sim.pos.z - _cam.z
        const ahead = dx * sim.heading.x + dz * sim.heading.z
        const side = dz * sim.heading.x - dx * sim.heading.z
        if (needsRelocate(TITAN_WADE, age - sim.holdStart, ahead, side)) {
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
      root.position.set(x, groundFn(x, z) + riseOffset(age - sim.riseFrom) + bob + defeatSink(sinceDefeat), z)
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
        for (const p of TITAN_BREAK_POINTS) getExplosionPool()?.explode(_p.set(p[0], p[1], p[2]).applyMatrix4(root.matrixWorld), TITAN_BREAK_DEATH_STYLE)
        eventBus.emit(CAMERA_TRAUMA_EVENT, BREAK_TRAUMA[0], BREAK_TRAUMA[1])
      }
    },
    [aim, pickSpot, groundFn, sim],
  )

  const renderWeakPoint = useCallback((w: WeakPointSpec, exposed: boolean) => {
    if (w.id === 'heart') return <mesh geometry={exposed ? TITAN_HEART_OPEN_GEO : TITAN_HEART_SHUT_GEO} material={TITAN_OBSIDIAN_MAT} />
    if (w.id === 'crown') return <mesh geometry={TITAN_CROWN_GEO} material={TITAN_OBSIDIAN_MAT} />
    return <mesh geometry={TITAN_VENT_GEO} material={TITAN_OBSIDIAN_MAT} scale={exposed ? 1 : SHUT_SCALE} />
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
      defeatBurst={BOSS_DEFEAT_DEATH_STYLE}
      deathStyle={TITAN_PART_DEATH_STYLE}
    />
  )
}
