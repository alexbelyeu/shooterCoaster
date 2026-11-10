import { useCallback, useContext, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import {
  LAVA_GOLEM_BODY_GEO, LAVA_GOLEM_CRACK_GEO, LAVA_GOLEM_ARM_GEO, LAVA_GOLEM_EYES_GEO,
  LAVA_GOLEM_BODY_MAT, LAVA_GOLEM_CRACK_MAT, LAVA_GOLEM_EYE_MAT,
} from './SharedEnemyAssets'

/**
 * Slow hulking ground enemy. Terrain-following, camera-facing.
 * Dark rock body with glowing lava cracks, arm sway animation.
 */
export default function LavaGolem(props: EnemyProps) {
  const { theta, moveSpeed } = useEnemyRandom(props.id, (rng) => ({ theta: 0.3 + rng() * 0.8, moveSpeed: 0.8 + rng() * 1.0 }))
  const modelRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Group>(null)
  const leftArmRef = useRef<THREE.Group>(null)
  const rightArmRef = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)
  const heightFn = useContext(TerrainContext)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      mesh.position.z += ((moveSpeed * Math.cos(time * theta)) / theta) * dt
      mesh.position.x += ((moveSpeed * Math.sin(time * theta)) / theta) * dt
      mesh.position.y = heightFn(mesh.position.x, mesh.position.z) + 5

      // Body wobble
      if (bodyRef.current) bodyRef.current.rotation.z = Math.sin(time * 2) * 0.04

      // Arm sway — opposite phases
      if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(time * 2.5) * 0.2
      if (rightArmRef.current) rightArmRef.current.rotation.x = -Math.sin(time * 2.5) * 0.2
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
      <group ref={modelRef} scale={[9, 9, 9]}>
        <group ref={bodyRef}>
          <mesh geometry={LAVA_GOLEM_BODY_GEO} material={LAVA_GOLEM_BODY_MAT} />
          <mesh geometry={LAVA_GOLEM_CRACK_GEO} material={LAVA_GOLEM_CRACK_MAT} />
          <mesh geometry={LAVA_GOLEM_EYES_GEO} material={LAVA_GOLEM_EYE_MAT} />
        </group>

        {/* Arms */}
        <group ref={leftArmRef} position={[-6.5, 14, 0]}>
          <mesh geometry={LAVA_GOLEM_ARM_GEO} material={LAVA_GOLEM_BODY_MAT} />
        </group>
        <group ref={rightArmRef} position={[6.5, 14, 0]}>
          <mesh geometry={LAVA_GOLEM_ARM_GEO} material={LAVA_GOLEM_BODY_MAT} />
        </group>
      </group>
    </EnemyBase>
  )
}
