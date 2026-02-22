import { useCallback, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'

/**
 * Golden bonus balloon: 5x points, emissive gold, bobs up and down,
 * auto-despawns after 5 seconds.
 */
export default function GoldenBalloon(props: EnemyProps) {
  const [visible, setVisible] = useState(true)
  const spawnTime = useRef(performance.now())

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      mesh.position.y += 0.3 * dt

      // Bob up and down
      mesh.position.y += Math.sin(time * 3) * 0.5

      // Auto-despawn after 5 seconds
      if (performance.now() - spawnTime.current > 5000) {
        setVisible(false)
      }
    },
    [],
  )

  if (!visible) return null

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group>
        {/* Golden balloon body */}
        <mesh scale={[1, 1.3, 1]}>
          <sphereGeometry args={[30, 16, 16]} />
          <meshStandardMaterial
            color="#ffd700"
            emissive="#ffd700"
            emissiveIntensity={1.5}
            metalness={0.6}
            roughness={0.2}
            toneMapped={false}
          />
        </mesh>

        {/* Knot */}
        <mesh position={[0, -35, 0]}>
          <sphereGeometry args={[4, 8, 8]} />
          <meshStandardMaterial color="#cc9900" metalness={0.5} roughness={0.3} />
        </mesh>

        {/* String */}
        <mesh position={[0, -65, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 55, 4]} />
          <meshBasicMaterial color="#cc9900" />
        </mesh>
      </group>
    </EnemyBase>
  )
}
