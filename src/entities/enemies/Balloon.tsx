import { useCallback, useMemo } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  BALLOON_BODY_GEO, BALLOON_KNOT_GEO, BALLOON_STRING_GEO,
  BALLOON_BODY_MATS, BALLOON_KNOT_MATS, BALLOON_STRING_MAT,
  BALLOON_COLOR_COUNT,
} from './SharedEnemyAssets'

/**
 * Realistic balloon: teardrop body (scaled sphere), hanging string,
 * varied bright colors, slight specular shine. Floats upward.
 */
export default function Balloon(props: EnemyProps) {
  const colorIndex = useMemo(
    () => Math.floor(Math.random() * BALLOON_COLOR_COUNT),
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
        <mesh scale={[1, 1.3, 1]} geometry={BALLOON_BODY_GEO} material={BALLOON_BODY_MATS[colorIndex]} />

        {/* Knot at the bottom */}
        <mesh position={[0, -35, 0]} geometry={BALLOON_KNOT_GEO} material={BALLOON_KNOT_MATS[colorIndex]} />

        {/* String hanging below */}
        <mesh position={[0, -65, 0]} geometry={BALLOON_STRING_GEO} material={BALLOON_STRING_MAT} />
      </group>
    </EnemyBase>
  )
}
