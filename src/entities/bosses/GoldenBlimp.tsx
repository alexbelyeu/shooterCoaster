import { useCallback, useContext, useRef } from 'react'
import * as THREE from 'three'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import { BALLOON_GEO } from '@/entities/enemies/SharedEnemyAssets'
import { BOSS_DEFEAT_DEATH_STYLE } from '@/effects/deathStyles'
import BossBase, { type BossFrame, type BossProps } from './BossBase'
import { isExposed, type WeakPointSpec } from './bossModel'
import { BLIMP_LAYOUT, GOLDEN_BLIMP, blimpHullRadius } from './bossSpecs'
import {
  BLIMP_BALLOON_MAT, BLIMP_CABLE_GEO, BLIMP_CABLE_MAT, BLIMP_GONDOLA_EXPOSED_MAT, BLIMP_GONDOLA_GEO, BLIMP_GONDOLA_MAT,
  BLIMP_GLINT_GEO, BLIMP_GLINT_MAT, BLIMP_HULL_GEO, BLIMP_HULL_MAT, BLIMP_PROP_AT, BLIMP_PROP_GEO,
} from './bossAssets'
import { flatForward } from './bossAim.hot'
import { followHeading } from './bossCycle.hot'

/** Rides with the coaster: a fixed boss would be behind the rider within seconds. */
const AHEAD = 760
const ABOVE = 170
const MIN_CLEARANCE = 220
const SIDE = 340
const CROSS_SECONDS = 24
const FOLLOW_TAU = 1.2
const FALL_ACCEL = 90
const FALL_PITCH = 0.5
const EXIT_SECONDS = 3.5
/** Propeller, radians a second; it winds down as the blimp falls. */
const PROP_SPIN = 14
/** A glint runs nose to tail over the envelope every GLINT_EVERY seconds, taking GLINT_SECONDS. */
const GLINT_EVERY = 4.5
const GLINT_SECONDS = 1.4
const GLINT_WIDTH = 20
const GLINT_OPACITY = 0.7
const { hullX, hullRx } = BLIMP_LAYOUT

const _fwd = new THREE.Vector3()
const _anchor = new THREE.Vector3()
const _camPos = new THREE.Vector3()

function renderWeakPoint(w: WeakPointSpec, exposed: boolean) {
  if (w.id === 'gondola') {
    return <mesh geometry={BLIMP_GONDOLA_GEO} material={exposed ? BLIMP_GONDOLA_EXPOSED_MAT : BLIMP_GONDOLA_MAT} />
  }
  return <mesh geometry={BALLOON_GEO} material={BLIMP_BALLOON_MAT} scale={BLIMP_LAYOUT.balloonScale} />
}

const towLine = <mesh geometry={BLIMP_CABLE_GEO} material={BLIMP_CABLE_MAT} />

/** Theme Park finale: pop the five towed balloons to expose the gondola, three hits on it bring the blimp down. */
export default function GoldenBlimp(props: BossProps) {
  const heightFn = useContext(TerrainContext)
  const motion = useRef({ placed: false, heading: new THREE.Vector3(), fallSpeed: 0 }).current
  const prop = useRef<THREE.Mesh>(null)
  const glint = useRef<THREE.Mesh>(null)

  const move = useCallback(
    ({ root, parts, camera, state, dt, age, sinceDefeat }: BossFrame) => {
      flatForward(camera, _fwd)
      followHeading(motion.heading, _fwd.x, _fwd.z, dt, !motion.placed)
      const h = motion.heading
      const rx = -h.z
      const rz = h.x
      const side = SIDE * (2 * Math.min(1, age / CROSS_SECONDS) - 1)
      camera.getWorldPosition(_camPos)
      _anchor.set(_camPos.x + h.x * AHEAD + rx * side, 0, _camPos.z + h.z * AHEAD + rz * side)
      _anchor.y = Math.max(_camPos.y + ABOVE, heightFn(_anchor.x, _anchor.z) + MIN_CLEARANCE) + Math.sin(age * 0.9) * 10

      const k = 1 - Math.exp(-dt / FOLLOW_TAU)
      if (!motion.placed) {
        root.position.copy(_anchor)
        motion.placed = true
      } else if (sinceDefeat < 0) {
        root.position.lerp(_anchor, k)
      } else {
        root.position.x += (_anchor.x - root.position.x) * k
        root.position.z += (_anchor.z - root.position.z) * k
        motion.fallSpeed += FALL_ACCEL * dt
        root.position.y -= motion.fallSpeed * dt
      }

      root.rotation.y = Math.atan2(-rz, rx)
      root.rotation.x = Math.sin(age * 0.5) * 0.03
      root.rotation.z = sinceDefeat < 0 ? Math.sin(age * 0.7) * 0.03 : -Math.min(FALL_PITCH, sinceDefeat * 0.25)

      for (let i = 0; i < GOLDEN_BLIMP.weakPoints.length; i++) {
        const w = GOLDEN_BLIMP.weakPoints[i]
        const part = parts.get(w.id)
        if (part && w.phase === 0) part.position.y = w.offset[1] + Math.sin(age * 1.7 + i * 1.3) * 6
      }
      if (prop.current) prop.current.rotation.x += PROP_SPIN * dt * (sinceDefeat < 0 ? 1 : Math.max(0, 1 - sinceDefeat / EXIT_SECONDS))
      if (glint.current) {
        const s = (age % GLINT_EVERY) / GLINT_SECONDS
        const x = hullX + hullRx * (1 - 2 * s)
        const r = blimpHullRadius(x)
        glint.current.visible = s < 1 && r > 0
        glint.current.position.x = x
        glint.current.scale.set(GLINT_WIDTH, r, r)
        BLIMP_GLINT_MAT.opacity = GLINT_OPACITY * Math.sin(Math.PI * Math.min(1, s))
      }
      if (isExposed(state, 'gondola')) BLIMP_GONDOLA_EXPOSED_MAT.emissiveIntensity = 1 + 0.6 * Math.sin(age * 7)
    },
    [heightFn, motion],
  )

  const body = (
    <>
      <mesh geometry={BLIMP_HULL_GEO} material={BLIMP_HULL_MAT} />
      <mesh ref={prop} geometry={BLIMP_PROP_GEO} material={BLIMP_HULL_MAT} position={BLIMP_PROP_AT} />
      <mesh ref={glint} geometry={BLIMP_GLINT_GEO} material={BLIMP_GLINT_MAT} visible={false} />
    </>
  )

  return (
    <BossBase
      {...props}
      spec={GOLDEN_BLIMP}
      move={move}
      body={body}
      rigging={towLine}
      renderWeakPoint={renderWeakPoint}
      exitSeconds={EXIT_SECONDS}
      defeatBurst={BOSS_DEFEAT_DEATH_STYLE}
    />
  )
}
