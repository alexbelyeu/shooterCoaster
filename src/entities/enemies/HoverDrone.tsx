import { useCallback, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { DRONE_BODY_GEO, DRONE_GLOW_GEO, DRONE_GLOW_MAT, DRONE_MAT } from './SharedEnemyAssets'

/** Radians of figure-eight per game second; how far (world units) the drift swings either way. */
const FIGURE_EIGHT_RATE = 0.9
const SWING = 40

/**
 * A hover drone (brief: docs/art/ENEMIES.md, #323): a dark quad-drone with cyan rotor rings and eye, turned to watch
 * the rider. It hovers where it was placed, bobbing, and drifts a figure-eight round it, nose dipped into the drift.
 */
export default function HoverDrone(props: EnemyProps) {
  const { phase, bobRate, tiltSign } = useEnemyRandom(props.id, (rng) => ({
    phase: rng() * Math.PI * 2,
    bobRate: 1.6 + rng() * 0.8,
    tiltSign: rng() < 0.5 ? -1 : 1,
  }))
  const modelRef = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, spawnPos: THREE.Vector3, time: number) => {
      const f = time * FIGURE_EIGHT_RATE + phase
      mesh.position.x = spawnPos.x + Math.sin(f) * SWING
      mesh.position.z = spawnPos.z + Math.sin(2 * f) * SWING * 0.5
      mesh.position.y = spawnPos.y + Math.sin(time * bobRate + phase) * 4
      const model = modelRef.current
      if (model) {
        // Banks into the swing's velocity
        model.rotation.z = Math.cos(f) * 0.22 * tiltSign
        model.rotation.x = 0.12 + Math.cos(2 * f) * 0.1
      }
    },
    [phase, bobRate, tiltSign],
  )

  useFrame(() => {
    const model = modelRef.current
    if (!model?.parent) return
    model.rotation.y = Math.atan2(camera.position.x - model.parent.position.x, camera.position.z - model.parent.position.z)
  })

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={modelRef} scale={[9, 9, 9]}>
        <mesh geometry={DRONE_BODY_GEO} material={DRONE_MAT} />
        <mesh geometry={DRONE_GLOW_GEO} material={DRONE_GLOW_MAT} />
      </group>
    </EnemyBase>
  )
}
