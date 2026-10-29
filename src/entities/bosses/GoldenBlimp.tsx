import { useCallback, useContext, useRef } from 'react'
import * as THREE from 'three'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import { BALLOON_GEO } from '@/entities/enemies/SharedEnemyAssets'
import BossBase, { type BossFrame, type BossProps } from './BossBase'
import BossConfetti from './BossConfetti'
import { isExposed, type WeakPointSpec } from './bossModel'
import { BLIMP_LAYOUT, GOLDEN_BLIMP } from './bossSpecs'
import {
  BLIMP_BALLOON_MAT, BLIMP_CABLE_GEO, BLIMP_CABLE_MAT, BLIMP_GONDOLA_EXPOSED_MAT, BLIMP_GONDOLA_GEO, BLIMP_GONDOLA_MAT,
  BLIMP_HULL_GEO, BLIMP_HULL_MAT,
} from './bossAssets'

/** Rides with the coaster: a fixed boss would be behind the rider within seconds. */
const AHEAD = 760
const ABOVE = 170
const MIN_CLEARANCE = 220
const SIDE = 340
const CROSS_SECONDS = 24
const HEADING_TAU = 2.5
const FOLLOW_TAU = 1.2
const FALL_ACCEL = 90
const FALL_PITCH = 0.5
const EXIT_SECONDS = 3.5

const _fwd = new THREE.Vector3()
const _anchor = new THREE.Vector3()
const _camPos = new THREE.Vector3()

function renderWeakPoint(w: WeakPointSpec, exposed: boolean) {
  if (w.id === 'gondola') {
    return <mesh geometry={BLIMP_GONDOLA_GEO} material={exposed ? BLIMP_GONDOLA_EXPOSED_MAT : BLIMP_GONDOLA_MAT} />
  }
  return <mesh geometry={BALLOON_GEO} material={BLIMP_BALLOON_MAT} scale={BLIMP_LAYOUT.balloonScale} />
}

const hull = <mesh geometry={BLIMP_HULL_GEO} material={BLIMP_HULL_MAT} />
const towLine = <mesh geometry={BLIMP_CABLE_GEO} material={BLIMP_CABLE_MAT} />

/** Theme Park finale: pop the five towed balloons to expose the gondola, three hits on it bring the blimp down. */
export default function GoldenBlimp(props: BossProps) {
  const heightFn = useContext(TerrainContext)
  const motion = useRef({ placed: false, heading: new THREE.Vector3(), fallSpeed: 0 }).current

  const move = useCallback(
    ({ root, parts, camera, state, dt, age, sinceDefeat }: BossFrame) => {
      camera.getWorldDirection(_fwd)
      _fwd.y = 0
      if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1)
      _fwd.normalize()
      if (!motion.placed) motion.heading.copy(_fwd)
      else {
        motion.heading.lerp(_fwd, 1 - Math.exp(-dt / HEADING_TAU))
        if (motion.heading.lengthSq() < 1e-6) motion.heading.copy(_fwd)
        motion.heading.normalize()
      }
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

      GOLDEN_BLIMP.weakPoints.forEach((w, i) => {
        const part = parts.get(w.id)
        if (part && w.phase === 0) part.position.y = w.offset[1] + Math.sin(age * 1.7 + i * 1.3) * 6
      })
      if (isExposed(state, 'gondola')) BLIMP_GONDOLA_EXPOSED_MAT.emissiveIntensity = 1 + 0.6 * Math.sin(age * 7)
    },
    [heightFn, motion],
  )

  return (
    <BossBase
      {...props}
      spec={GOLDEN_BLIMP}
      move={move}
      body={hull}
      rigging={towLine}
      renderWeakPoint={renderWeakPoint}
      exitSeconds={EXIT_SECONDS}
    >
      <BossConfetti bossId={props.id} />
    </BossBase>
  )
}
