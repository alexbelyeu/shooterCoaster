import { useCallback, useContext, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import {
  FIRE_IMP_BODY_GEO, FIRE_IMP_HORN_GEO, FIRE_IMP_TAIL_GEO,
  FIRE_IMP_TAIL_SPIKE_GEO, FIRE_IMP_EYE_GEO,
  FIRE_IMP_BODY_MAT, FIRE_IMP_HORN_MAT, FIRE_IMP_EYE_MAT,
} from './SharedEnemyAssets'

/**
 * Small, fast ground enemy. Erratic darting movement with sudden direction
 * changes. Dark red with iridescent sheen, dual horns, spiked tail.
 */
export default function FireImp(props: EnemyProps) {
  const moveSpeed = useMemo(() => 3 + Math.random() * 2, [])
  const dirChangeInterval = useMemo(() => 2 + Math.random() * 1, [])
  const dirRef = useRef(Math.random() * Math.PI * 2)
  const lastDirChange = useRef(0)
  const modelRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Group>(null)
  const tailRef = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)
  const heightFn = useContext(TerrainContext)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60

      // Sudden direction changes
      if (time - lastDirChange.current > dirChangeInterval) {
        dirRef.current += (Math.random() - 0.5) * Math.PI
        lastDirChange.current = time
      }

      mesh.position.x += Math.cos(dirRef.current) * moveSpeed * dt
      mesh.position.z += Math.sin(dirRef.current) * moveSpeed * dt
      mesh.position.y = heightFn(mesh.position.x, mesh.position.z) + 3

      // Body lean into movement
      if (bodyRef.current) {
        bodyRef.current.rotation.z = Math.sin(time * 4) * 0.06
      }

      // Tail sway
      if (tailRef.current) {
        tailRef.current.rotation.y = Math.sin(time * 6) * 0.4
      }
    },
    [moveSpeed, dirChangeInterval, heightFn],
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
      <group ref={modelRef} scale={[8, 8, 8]}>
        <group ref={bodyRef}>
          {/* Body */}
          <mesh geometry={FIRE_IMP_BODY_GEO} material={FIRE_IMP_BODY_MAT} />

          {/* Horns */}
          <mesh position={[-1.5, 9, 1]} rotation={[0.3, 0, -0.2]} geometry={FIRE_IMP_HORN_GEO} material={FIRE_IMP_HORN_MAT} />
          <mesh position={[1.5, 9, 1]} rotation={[0.3, 0, 0.2]} geometry={FIRE_IMP_HORN_GEO} material={FIRE_IMP_HORN_MAT} />

          {/* Eyes */}
          <mesh position={[-1, 7, 2.8]} geometry={FIRE_IMP_EYE_GEO} material={FIRE_IMP_EYE_MAT} />
          <mesh position={[1, 7, 2.8]} geometry={FIRE_IMP_EYE_GEO} material={FIRE_IMP_EYE_MAT} />
        </group>

        {/* Tail with spike */}
        <group ref={tailRef} position={[0, 2, -3]}>
          <mesh geometry={FIRE_IMP_TAIL_GEO} material={FIRE_IMP_BODY_MAT} rotation={[Math.PI / 4, 0, 0]} />
          <mesh position={[0, -3.5, -3]} geometry={FIRE_IMP_TAIL_SPIKE_GEO} material={FIRE_IMP_HORN_MAT} />
        </group>
      </group>
    </EnemyBase>
  )
}
