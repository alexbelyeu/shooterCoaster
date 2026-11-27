import { useCallback, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import {
  EMBER_WISP_CORE_GEO, EMBER_WISP_CORE_MAT, EMBER_WISP_FLICKER, EMBER_WISP_HEAT,
  EMBER_WISP_RIBBON_MAT, EMBER_WISP_RIBBON_ROOT, EMBER_WISP_RIBBONS_GEO,
} from './SharedEnemyAssets'
import { EMBER_RISE } from './slipAway.hot'
import { useSlipAway } from './useSlipAway'

/** Radians of figure-eight per game second, and how far the ribbons trail per unit of speed (radians per world unit / s). */
const FIGURE_EIGHT_RATE = 1.3
const RIBBON_TRAIL = 0.012
const RIBBON_TRAIL_MAX = 0.9

/**
 * A drifting flame spirit (brief: docs/art/ENEMIES.md): a teardrop core with coal eyes, turned to the rider, and
 * three ribbon flames that trail its motion, lagging behind it, and flicker in their material's vertex shader.
 * It drifts in a lazy figure-eight. Appears in large swarms; one left too long once seen rises out of the frame (`EMBER_RISE`).
 */
export default function EmberWisp(props: EnemyProps) {
  const { driftAngle, driftSpeed, phase } = useEnemyRandom(props.id, (rng) => ({
    driftAngle: rng() * Math.PI * 2, driftSpeed: 0.3 + rng() * 0.5, phase: rng() * Math.PI * 2,
  }))
  const modelRef = useRef<THREE.Group>(null)
  const leanRef = useRef<THREE.Group>(null)
  const ribbonsRef = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  // The velocity the ribbons trail, in the model's frame, eased so they lag behind a turn.
  const trail = useRef({ x: 0, z: 0, px: NaN, pz: NaN })
  const rise = useSlipAway(EMBER_RISE)
  const risen = useRef(0)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      const f = time * FIGURE_EIGHT_RATE + phase
      const drift = driftAngle + time * 0.5
      mesh.position.x += (Math.cos(drift) * driftSpeed + Math.cos(f) * 0.6) * dt
      mesh.position.z += (Math.sin(drift) * driftSpeed) * dt
      mesh.position.y += Math.cos(2 * f) * 0.35 * dt
      const up = rise(mesh.position, time)
      if (up < 0) return 'escaped'
      mesh.position.y += up - risen.current
      risen.current = up

      EMBER_WISP_FLICKER.value = time
      EMBER_WISP_HEAT.value = 1 + 0.12 * Math.sin(time * 9 + phase) * Math.sin(time * 5.3)

      const tr = trail.current
      const yaw = modelRef.current?.rotation.y ?? 0
      if (delta > 0 && !Number.isNaN(tr.px)) {
        const vx = (mesh.position.x - tr.px) / delta
        const vz = (mesh.position.z - tr.pz) / delta
        const lx = vx * Math.cos(yaw) - vz * Math.sin(yaw)
        const lz = vx * Math.sin(yaw) + vz * Math.cos(yaw)
        const ease = 1 - Math.exp(-delta * 3)
        tr.x += (lx - tr.x) * ease
        tr.z += (lz - tr.z) * ease
      }
      tr.px = mesh.position.x
      tr.pz = mesh.position.z

      // The tip leans back off the motion, the ribbons more so.
      const back = THREE.MathUtils.clamp(-tr.z * RIBBON_TRAIL, -RIBBON_TRAIL_MAX, RIBBON_TRAIL_MAX)
      const side = THREE.MathUtils.clamp(tr.x * RIBBON_TRAIL, -RIBBON_TRAIL_MAX, RIBBON_TRAIL_MAX)
      leanRef.current?.rotation.set(back * 0.35, 0, side * 0.35)
      ribbonsRef.current?.rotation.set(back * 0.65, 0, side * 0.65)
      const pulse = 1 + 0.05 * Math.sin(time * 6 + phase)
      leanRef.current?.scale.set(pulse, 1 / pulse, pulse)
    },
    [driftAngle, driftSpeed, phase, rise],
  )

  useFrame(() => {
    const model = modelRef.current
    if (!model?.parent) return
    model.rotation.y = Math.atan2(camera.position.x - model.parent.position.x, camera.position.z - model.parent.position.z)
  })

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={modelRef} scale={[8, 8, 8]}>
        <group ref={leanRef}>
          <mesh geometry={EMBER_WISP_CORE_GEO} material={EMBER_WISP_CORE_MAT} />
          <mesh ref={ribbonsRef} position={EMBER_WISP_RIBBON_ROOT} geometry={EMBER_WISP_RIBBONS_GEO} material={EMBER_WISP_RIBBON_MAT} />
        </group>
      </group>
    </EnemyBase>
  )
}
