import { useCallback, useMemo } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  SNOWMAN_BOTTOM_GEO, SNOWMAN_MIDDLE_GEO, SNOWMAN_TOP_GEO,
  SNOWMAN_SCOUT_MAT,
  SNOWMAN_EYE_GEO, SNOWMAN_EYE_MAT,
  SNOWMAN_NOSE_GEO, SNOWMAN_NOSE_MAT,
  SNOWMAN_SCOUT_SHARD_GEO, SNOWMAN_SCOUT_SHARD_MAT,
} from './SharedEnemyAssets'

/**
 * Small, fast scout snowman with icy blue tint and ice-shard crown.
 * 60% scale of the normal snowman, double orbit speed.
 */
export default function SnowmanScout(props: EnemyProps) {
  const theta = useMemo(() => 1 + Math.random() * 2, [])
  const moveSpeed = useMemo(() => 3 + Math.random() * 2, [])

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      mesh.position.z += ((moveSpeed * Math.cos(time * theta)) / theta) * dt
      mesh.position.x += ((moveSpeed * Math.sin(time * theta)) / theta) * dt
      mesh.position.y += (0.2 + 3 * Math.sin((time / 3) * theta + 1000)) * dt
    },
    [theta, moveSpeed],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group scale={[0.6, 0.6, 0.6]}>
        {/* Body — icy blue */}
        <mesh position={[0, 0, 0]} geometry={SNOWMAN_BOTTOM_GEO} material={SNOWMAN_SCOUT_MAT} />
        <mesh position={[0, 25, 0]} geometry={SNOWMAN_MIDDLE_GEO} material={SNOWMAN_SCOUT_MAT} />
        <mesh position={[0, 42, 0]} geometry={SNOWMAN_TOP_GEO} material={SNOWMAN_SCOUT_MAT} />

        {/* Coal eyes */}
        <mesh position={[-3.5, 45, 8]} geometry={SNOWMAN_EYE_GEO} material={SNOWMAN_EYE_MAT} />
        <mesh position={[3.5, 45, 8]} geometry={SNOWMAN_EYE_GEO} material={SNOWMAN_EYE_MAT} />

        {/* Carrot nose */}
        <mesh position={[0, 42, 10]} rotation={[Math.PI / 2, 0, 0]} geometry={SNOWMAN_NOSE_GEO} material={SNOWMAN_NOSE_MAT} />

        {/* Ice shard crown — 3 shards on top of head */}
        <mesh position={[0, 54, 0]} geometry={SNOWMAN_SCOUT_SHARD_GEO} material={SNOWMAN_SCOUT_SHARD_MAT} />
        <mesh position={[-4, 52, 0]} rotation={[0, 0, 0.3]} geometry={SNOWMAN_SCOUT_SHARD_GEO} material={SNOWMAN_SCOUT_SHARD_MAT} />
        <mesh position={[4, 52, 0]} rotation={[0, 0, -0.3]} geometry={SNOWMAN_SCOUT_SHARD_GEO} material={SNOWMAN_SCOUT_SHARD_MAT} />
      </group>
    </EnemyBase>
  )
}
