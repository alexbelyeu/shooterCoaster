import { useCallback, useMemo } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'

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
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[20, 12, 12]} />
          <meshPhongMaterial color="#f0f0f0" flatShading />
        </mesh>
        <mesh position={[0, 25, 0]}>
          <sphereGeometry args={[14, 12, 12]} />
          <meshPhongMaterial color="#f0f0f0" flatShading />
        </mesh>
        <mesh position={[0, 42, 0]}>
          <sphereGeometry args={[10, 12, 12]} />
          <meshPhongMaterial color="#f0f0f0" flatShading />
        </mesh>
      </group>
    </EnemyBase>
  )
}
