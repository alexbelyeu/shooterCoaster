import { useCallback, useMemo } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'

/**
 * Port of Crows.js: dark shapes that fly horizontally.
 * Original: position.x += 0.01, position.z += movementZ per frame (at 60fps)
 */
export default function Crow(props: EnemyProps) {
  const movementZ = useMemo(() => Math.random() * 4 + 1, [])

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, _time: number, delta: number) => {
      const dt = delta * 60
      mesh.position.x += 0.01 * dt
      mesh.position.z += movementZ * dt
    },
    [movementZ],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <mesh scale={[10, 10, 10]}>
        <coneGeometry args={[3, 8, 4]} />
        <meshPhongMaterial color="#111111" flatShading />
      </mesh>
    </EnemyBase>
  )
}
