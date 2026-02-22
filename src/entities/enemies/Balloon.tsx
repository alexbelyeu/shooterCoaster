import { useCallback, useMemo } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'

const BALLOON_COLORS = [
  '#ff3333', '#ff6633', '#ffcc00', '#33cc33', '#3399ff',
  '#9933ff', '#ff33cc', '#ff6699', '#00cccc', '#66ff33',
]

/**
 * Realistic balloon: teardrop body (scaled sphere), hanging string,
 * varied bright colors, slight specular shine. Floats upward.
 */
export default function Balloon(props: EnemyProps) {
  const color = useMemo(
    () => BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)],
    [],
  )

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, _time: number, delta: number) => {
      const dt = delta * 60 // normalize to 60fps
      mesh.position.y += 0.3 * dt
      mesh.position.z += 0.2 * dt
    },
    [],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group>
        {/* Balloon body — teardrop: sphere scaled taller */}
        <mesh scale={[1, 1.3, 1]}>
          <sphereGeometry args={[30, 16, 16]} />
          <meshPhongMaterial
            color={color}
            specular="#ffffff"
            shininess={60}
            flatShading={false}
          />
        </mesh>

        {/* Knot at the bottom */}
        <mesh position={[0, -35, 0]}>
          <sphereGeometry args={[4, 8, 8]} />
          <meshPhongMaterial color={color} />
        </mesh>

        {/* String hanging below */}
        <mesh position={[0, -65, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 55, 4]} />
          <meshBasicMaterial color="#888888" />
        </mesh>
      </group>
    </EnemyBase>
  )
}
