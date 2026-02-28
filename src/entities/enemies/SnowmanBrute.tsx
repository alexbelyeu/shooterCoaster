import { useCallback, useMemo } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  SNOWMAN_BOTTOM_GEO, SNOWMAN_MIDDLE_GEO, SNOWMAN_TOP_GEO, SNOWMAN_MAT,
  SNOWMAN_EYE_GEO, SNOWMAN_EYE_MAT,
  SNOWMAN_NOSE_GEO, SNOWMAN_NOSE_MAT,
  SNOWMAN_BUTTON_GEO, SNOWMAN_BUTTON_MAT,
  SNOWMAN_ARM_GEO, SNOWMAN_ARM_MAT,
  SNOWMAN_HAT_BRIM_GEO, SNOWMAN_HAT_TOP_GEO, SNOWMAN_HAT_MAT,
  SNOWMAN_SCARF_GEO, SNOWMAN_SCARF_MAT,
} from './SharedEnemyAssets'

/**
 * Massive snowman brute — 180% scale, top hat, scarf, slow movement.
 * Lumbering orbit with heavy Y bobbing.
 */
export default function SnowmanBrute(props: EnemyProps) {
  const theta = useMemo(() => 0.3 + Math.random() * 0.7, [])
  const moveSpeed = useMemo(() => 0.8 + Math.random() * 0.6, [])

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      mesh.position.z += ((moveSpeed * Math.cos(time * theta)) / theta) * dt
      mesh.position.x += ((moveSpeed * Math.sin(time * theta)) / theta) * dt
      mesh.position.y += (0.15 + 2 * Math.sin((time / 6) * theta + 3000)) * dt
    },
    [theta, moveSpeed],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group scale={[1.8, 1.8, 1.8]}>
        {/* Body */}
        <mesh position={[0, 0, 0]} geometry={SNOWMAN_BOTTOM_GEO} material={SNOWMAN_MAT} />
        <mesh position={[0, 25, 0]} geometry={SNOWMAN_MIDDLE_GEO} material={SNOWMAN_MAT} />
        <mesh position={[0, 42, 0]} geometry={SNOWMAN_TOP_GEO} material={SNOWMAN_MAT} />

        {/* Top hat */}
        <mesh position={[0, 52, 0]} geometry={SNOWMAN_HAT_BRIM_GEO} material={SNOWMAN_HAT_MAT} />
        <mesh position={[0, 58, 0]} geometry={SNOWMAN_HAT_TOP_GEO} material={SNOWMAN_HAT_MAT} />

        {/* Scarf around neck */}
        <mesh position={[0, 34, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={SNOWMAN_SCARF_GEO} material={SNOWMAN_SCARF_MAT} />

        {/* Coal eyes */}
        <mesh position={[-3.5, 45, 8]} geometry={SNOWMAN_EYE_GEO} material={SNOWMAN_EYE_MAT} />
        <mesh position={[3.5, 45, 8]} geometry={SNOWMAN_EYE_GEO} material={SNOWMAN_EYE_MAT} />

        {/* Carrot nose */}
        <mesh position={[0, 42, 10]} rotation={[Math.PI / 2, 0, 0]} geometry={SNOWMAN_NOSE_GEO} material={SNOWMAN_NOSE_MAT} />

        {/* Buttons */}
        <mesh position={[0, 30, 13]} geometry={SNOWMAN_BUTTON_GEO} material={SNOWMAN_BUTTON_MAT} />
        <mesh position={[0, 25, 13.5]} geometry={SNOWMAN_BUTTON_GEO} material={SNOWMAN_BUTTON_MAT} />
        <mesh position={[0, 20, 13]} geometry={SNOWMAN_BUTTON_GEO} material={SNOWMAN_BUTTON_MAT} />

        {/* Thick stick arms */}
        <mesh position={[-18, 26, 0]} rotation={[0, 0, -0.5]} geometry={SNOWMAN_ARM_GEO} material={SNOWMAN_ARM_MAT} />
        <mesh position={[18, 26, 0]} rotation={[0, 0, 0.5]} geometry={SNOWMAN_ARM_GEO} material={SNOWMAN_ARM_MAT} />
      </group>
    </EnemyBase>
  )
}
