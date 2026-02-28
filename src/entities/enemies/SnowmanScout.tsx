import { useCallback, useContext, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import {
  SNOWMAN_BOTTOM_GEO, SNOWMAN_MIDDLE_GEO, SNOWMAN_TOP_GEO,
  SNOWMAN_SCOUT_MAT,
  SNOWMAN_EYE_GEO, SNOWMAN_EYE_MAT,
  SNOWMAN_NOSE_GEO, SNOWMAN_NOSE_MAT,
  SNOWMAN_MOUTH_GEO, SNOWMAN_MOUTH_MAT,
  SNOWMAN_SCOUT_SHARD_GEO, SNOWMAN_SCOUT_SHARD_MAT,
} from './SharedEnemyAssets'

/**
 * Small, fast scout snowman with icy blue tint and ice-shard crown.
 * 60% scale of the normal snowman, double orbit speed.
 */
export default function SnowmanScout(props: EnemyProps) {
  const theta = useMemo(() => 1 + Math.random() * 2, [])
  const moveSpeed = useMemo(() => 3 + Math.random() * 2, [])
  const modelRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)
  const heightFn = useContext(TerrainContext)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      mesh.position.z += ((moveSpeed * Math.cos(time * theta)) / theta) * dt
      mesh.position.x += ((moveSpeed * Math.sin(time * theta)) / theta) * dt
      mesh.position.y = heightFn(mesh.position.x, mesh.position.z) + 12

      if (bodyRef.current) bodyRef.current.rotation.z = Math.sin(time * 3.5) * 0.06
    },
    [theta, moveSpeed, heightFn],
  )

  useFrame(() => {
    if (!modelRef.current?.parent) return
    const parent = modelRef.current.parent
    const dx = camera.position.x - parent.position.x
    const dz = camera.position.z - parent.position.z
    modelRef.current.rotation.y = Math.atan2(dx, dz)
  })

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={modelRef} scale={[0.6, 0.6, 0.6]}>
        <group ref={bodyRef}>
          {/* Body — icy blue */}
          <mesh position={[0, 0, 0]} geometry={SNOWMAN_BOTTOM_GEO} material={SNOWMAN_SCOUT_MAT} />
          <mesh position={[0, 25, 0]} geometry={SNOWMAN_MIDDLE_GEO} material={SNOWMAN_SCOUT_MAT} />
          <mesh position={[0, 42, 0]} geometry={SNOWMAN_TOP_GEO} material={SNOWMAN_SCOUT_MAT} />

          {/* Coal eyes */}
          <mesh position={[-3.5, 45, 8]} geometry={SNOWMAN_EYE_GEO} material={SNOWMAN_EYE_MAT} />
          <mesh position={[3.5, 45, 8]} geometry={SNOWMAN_EYE_GEO} material={SNOWMAN_EYE_MAT} />

          {/* Carrot nose */}
          <mesh position={[0, 42, 10]} rotation={[Math.PI / 2, 0, 0]} geometry={SNOWMAN_NOSE_GEO} material={SNOWMAN_NOSE_MAT} />

          {/* Coal smile */}
          {[-0.6, -0.3, 0, 0.3, 0.6].map((xOff, i) => (
            <mesh
              key={`mouth-${i}`}
              position={[xOff * 4, 39 - Math.abs(xOff) * 2, 9.5]}
              geometry={SNOWMAN_MOUTH_GEO}
              material={SNOWMAN_MOUTH_MAT}
            />
          ))}

          {/* Ice shard crown — 5 shards for fuller silhouette */}
          <mesh position={[0, 54, 0]} geometry={SNOWMAN_SCOUT_SHARD_GEO} material={SNOWMAN_SCOUT_SHARD_MAT} />
          <mesh position={[-4, 52, 0]} rotation={[0, 0, 0.3]} geometry={SNOWMAN_SCOUT_SHARD_GEO} material={SNOWMAN_SCOUT_SHARD_MAT} />
          <mesh position={[4, 52, 0]} rotation={[0, 0, -0.3]} geometry={SNOWMAN_SCOUT_SHARD_GEO} material={SNOWMAN_SCOUT_SHARD_MAT} />
          <mesh position={[-2, 53, 3]} rotation={[0.2, 0.4, 0.2]} scale={[0.75, 0.75, 0.75]} geometry={SNOWMAN_SCOUT_SHARD_GEO} material={SNOWMAN_SCOUT_SHARD_MAT} />
          <mesh position={[2, 53, 3]} rotation={[-0.2, -0.4, -0.2]} scale={[0.75, 0.75, 0.75]} geometry={SNOWMAN_SCOUT_SHARD_GEO} material={SNOWMAN_SCOUT_SHARD_MAT} />
        </group>
      </group>
    </EnemyBase>
  )
}
