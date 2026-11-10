import { useCallback, useContext, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { marchHeading } from '@/entities/spawning/spawnPlacement'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import {
  SNOWMAN_BODY_GEO, SNOWMAN_SCOUT_MAT,
  SNOWMAN_FACE_GEO, SNOWMAN_COAL_MAT,
  SNOWMAN_NOSE_GEO, SNOWMAN_NOSE_MAT,
  SNOWMAN_SCOUT_CROWN_GEO, SNOWMAN_SCOUT_SHARD_MAT,
} from './SharedEnemyAssets'

/** Per 60 fps frame: slow enough that a rank is still ahead when the rider reaches it. */
const MARCH_SPEED = 0.6

/** Smaller, faster scout snowman (0.9× the base model) with an icy tint and ice-shard crown. */
export default function SnowmanScout(props: EnemyProps) {
  const { theta, moveSpeed } = useEnemyRandom(props.id, (rng) => ({ theta: 1 + rng() * 2, moveSpeed: 3 + rng() * 2 }))
  const modelRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)
  const heightFn = useContext(TerrainContext)

  const heading = marchHeading(props.motion)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      if (heading === undefined) {
        mesh.position.z += ((moveSpeed * Math.cos(time * theta)) / theta) * dt
        mesh.position.x += ((moveSpeed * Math.sin(time * theta)) / theta) * dt
      } else {
        mesh.position.x += Math.cos(heading) * MARCH_SPEED * dt
        mesh.position.z += Math.sin(heading) * MARCH_SPEED * dt
      }
      mesh.position.y = heightFn(mesh.position.x, mesh.position.z) + 18

      if (bodyRef.current) bodyRef.current.rotation.z = Math.sin(time * 3.5) * 0.06
    },
    [theta, moveSpeed, heightFn, heading],
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
      <group ref={modelRef} scale={[0.9, 0.9, 0.9]}>
        <group ref={bodyRef}>
          <mesh geometry={SNOWMAN_BODY_GEO} material={SNOWMAN_SCOUT_MAT} />
          <mesh geometry={SNOWMAN_FACE_GEO} material={SNOWMAN_COAL_MAT} />
          <mesh geometry={SNOWMAN_NOSE_GEO} material={SNOWMAN_NOSE_MAT} />
          <mesh geometry={SNOWMAN_SCOUT_CROWN_GEO} material={SNOWMAN_SCOUT_SHARD_MAT} />
        </group>
      </group>
    </EnemyBase>
  )
}
