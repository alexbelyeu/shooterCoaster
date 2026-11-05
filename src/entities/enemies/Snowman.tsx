import { useCallback, useContext, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import {
  SNOWMAN_BODY_GEO, SNOWMAN_MAT,
  SNOWMAN_COAL_GEO, SNOWMAN_COAL_MAT,
  SNOWMAN_NOSE_GEO, SNOWMAN_NOSE_MAT,
  SNOWMAN_LEFT_ARM_GEO, SNOWMAN_RIGHT_ARM_GEO, SNOWMAN_ARM_MAT,
} from './SharedEnemyAssets'

export default function Snowman(props: EnemyProps) {
  const theta = useMemo(() => 0.5 + Math.random() * 1.5, [])
  const moveSpeed = useMemo(() => 1.5 + Math.random() * 1.5, [])
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
      mesh.position.y = heightFn(mesh.position.x, mesh.position.z) + 26

      if (bodyRef.current) bodyRef.current.rotation.z = Math.sin(time * 3) * 0.06
      if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(time * 3) * 0.15
      if (rightArmRef.current) rightArmRef.current.rotation.x = -Math.sin(time * 3) * 0.15
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
      <group ref={modelRef} scale={[1.3, 1.3, 1.3]}>
        <group ref={bodyRef}>
          <mesh geometry={SNOWMAN_BODY_GEO} material={SNOWMAN_MAT} />
          <mesh geometry={SNOWMAN_COAL_GEO} material={SNOWMAN_COAL_MAT} />
          <mesh geometry={SNOWMAN_NOSE_GEO} material={SNOWMAN_NOSE_MAT} />
        </group>

        {/* Stick arms with twig branches */}
        <group ref={leftArmRef} position={[-18, 26, 0]} rotation={[0, 0, -0.6]}>
          <mesh geometry={SNOWMAN_LEFT_ARM_GEO} material={SNOWMAN_ARM_MAT} />
        </group>
        <group ref={rightArmRef} position={[18, 26, 0]} rotation={[0, 0, 0.6]}>
          <mesh geometry={SNOWMAN_RIGHT_ARM_GEO} material={SNOWMAN_ARM_MAT} />
        </group>
      </group>
    </EnemyBase>
  )
}
