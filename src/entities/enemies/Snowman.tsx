import { useCallback, useMemo } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  SNOWMAN_BOTTOM_GEO, SNOWMAN_MIDDLE_GEO, SNOWMAN_TOP_GEO, SNOWMAN_MAT,
} from './SharedEnemyAssets'

/**
 * Port of Snowman.js: orbit + sinusoidal Y bobbing.
 * Original frame-rate dependent at 60fps.
 */
export default function Snowman(props: EnemyProps) {
  const theta = useMemo(() => Math.random() * Math.PI, [])

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      mesh.position.z += ((5 * Math.cos(time * theta)) / theta) * dt
      mesh.position.x += ((5 * Math.sin(time * theta)) / theta) * dt
      mesh.position.y += (0.75 + 20 * Math.sin((time / 4) * theta + 2000)) * dt
    },
    [theta],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group scale={[1.2, 1.2, 0.4]} rotation={[Math.PI, 0, 0]}>
        <mesh position={[0, 0, 0]} geometry={SNOWMAN_BOTTOM_GEO} material={SNOWMAN_MAT} />
        <mesh position={[0, 25, 0]} geometry={SNOWMAN_MIDDLE_GEO} material={SNOWMAN_MAT} />
        <mesh position={[0, 42, 0]} geometry={SNOWMAN_TOP_GEO} material={SNOWMAN_MAT} />
      </group>
    </EnemyBase>
  )
}
