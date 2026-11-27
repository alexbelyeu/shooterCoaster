import { useCallback, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { DRONE_BOB, DRONE_SWING } from './hoverDroneMotion'
import { DRONE_GEO, DRONE_MAT } from './SharedEnemyAssets'
import { DRONE_FLEE } from './slipAway.hot'
import { useSlipAway } from './useSlipAway'

/** Radians of figure-eight per game second. */
const FIGURE_EIGHT_RATE = 0.9

/**
 * A hover drone (brief: docs/art/ENEMIES.md, #323): a dark quad-drone with cyan rotor rings and eye, turned to watch
 * the rider. It hovers where it was placed, bobbing, and drifts a figure-eight round it, nose dipped into the drift. One
 * left too long once the rider has seen it climbs out of the canyon, unscored (`DRONE_FLEE`, #1059).
 */
export default function HoverDrone(props: EnemyProps) {
  const { phase, bobRate, tiltSign } = useEnemyRandom(props.id, (rng) => ({
    phase: rng() * Math.PI * 2,
    bobRate: 1.6 + rng() * 0.8,
    tiltSign: rng() < 0.5 ? -1 : 1,
  }))
  const modelRef = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)
  const flee = useSlipAway(DRONE_FLEE)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, spawnPos: THREE.Vector3, time: number) => {
      const fled = flee(mesh.position, time)
      if (fled < 0) return 'escaped'
      const f = time * FIGURE_EIGHT_RATE + phase
      mesh.position.x = spawnPos.x + Math.sin(f) * DRONE_SWING.x
      mesh.position.z = spawnPos.z + Math.sin(2 * f) * DRONE_SWING.z
      mesh.position.y = spawnPos.y + Math.sin(time * bobRate + phase) * DRONE_BOB + fled
      const model = modelRef.current
      if (model) {
        // Banks into the swing's velocity
        model.rotation.z = Math.cos(f) * 0.22 * tiltSign
        model.rotation.x = 0.12 + Math.cos(2 * f) * 0.1
      }
    },
    [phase, bobRate, tiltSign, flee],
  )

  useFrame(() => {
    const model = modelRef.current
    if (!model?.parent) return
    model.rotation.y = Math.atan2(camera.position.x - model.parent.position.x, camera.position.z - model.parent.position.z)
  })

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={modelRef} scale={[9, 9, 9]}>
        <mesh geometry={DRONE_GEO} material={DRONE_MAT} />
      </group>
    </EnemyBase>
  )
}
