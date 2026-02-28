import { useCallback, useContext, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import {
  SNOWMAN_BOTTOM_GEO, SNOWMAN_MIDDLE_GEO, SNOWMAN_TOP_GEO, SNOWMAN_MAT,
  SNOWMAN_EYE_GEO, SNOWMAN_EYE_MAT,
  SNOWMAN_NOSE_GEO, SNOWMAN_NOSE_MAT,
  SNOWMAN_BUTTON_GEO, SNOWMAN_BUTTON_MAT, SNOWMAN_MOUTH_GEO, SNOWMAN_MOUTH_MAT,
  SNOWMAN_ARM_GEO, SNOWMAN_ARM_MAT, SNOWMAN_TWIG_GEO, SNOWMAN_TWIG_MAT,
  SNOWMAN_HAT_BRIM_GEO, SNOWMAN_HAT_TOP_GEO, SNOWMAN_HAT_BAND_GEO, SNOWMAN_HAT_MAT, SNOWMAN_HAT_BAND_MAT,
  SNOWMAN_SCARF_GEO, SNOWMAN_SCARF_MAT, SNOWMAN_SCARF_TAIL_GEO,
} from './SharedEnemyAssets'

/**
 * Massive snowman brute — 180% scale, top hat, scarf, slow movement.
 * Lumbering orbit with heavy Y bobbing.
 */
export default function SnowmanBrute(props: EnemyProps) {
  const theta = useMemo(() => 0.3 + Math.random() * 0.7, [])
  const moveSpeed = useMemo(() => 0.8 + Math.random() * 0.6, [])
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
      mesh.position.y = heightFn(mesh.position.x, mesh.position.z) + 36

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
      <group ref={modelRef} scale={[1.8, 1.8, 1.8]}>
        <group ref={bodyRef}>
          {/* Body */}
          <mesh position={[0, 0, 0]} geometry={SNOWMAN_BOTTOM_GEO} material={SNOWMAN_MAT} />
          <mesh position={[0, 25, 0]} geometry={SNOWMAN_MIDDLE_GEO} material={SNOWMAN_MAT} />
          <mesh position={[0, 42, 0]} geometry={SNOWMAN_TOP_GEO} material={SNOWMAN_MAT} />

          {/* Top hat */}
          <mesh position={[0, 52, 0]} geometry={SNOWMAN_HAT_BRIM_GEO} material={SNOWMAN_HAT_MAT} />
          <mesh position={[0, 58, 0]} geometry={SNOWMAN_HAT_TOP_GEO} material={SNOWMAN_HAT_MAT} />
          <mesh position={[0, 54, 0]} geometry={SNOWMAN_HAT_BAND_GEO} material={SNOWMAN_HAT_BAND_MAT} />

          {/* Scarf around neck + trailing end */}
          <mesh position={[0, 34, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={SNOWMAN_SCARF_GEO} material={SNOWMAN_SCARF_MAT} />
          <mesh position={[7, 30, 7]} rotation={[0.4, 0.3, 0.2]} geometry={SNOWMAN_SCARF_TAIL_GEO} material={SNOWMAN_SCARF_MAT} />

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

          {/* Buttons */}
          <mesh position={[0, 30, 13]} geometry={SNOWMAN_BUTTON_GEO} material={SNOWMAN_BUTTON_MAT} />
          <mesh position={[0, 25, 13.5]} geometry={SNOWMAN_BUTTON_GEO} material={SNOWMAN_BUTTON_MAT} />
          <mesh position={[0, 20, 13]} geometry={SNOWMAN_BUTTON_GEO} material={SNOWMAN_BUTTON_MAT} />
        </group>

        {/* Thick stick arms with branches */}
        <group ref={leftArmRef} position={[-18, 26, 0]} rotation={[0, 0, -0.5]}>
          <mesh geometry={SNOWMAN_ARM_GEO} material={SNOWMAN_ARM_MAT} />
          <mesh position={[0, 4, 0]} rotation={[0.3, 0, 0.4]} geometry={SNOWMAN_TWIG_GEO} material={SNOWMAN_TWIG_MAT} />
          <mesh position={[0, -3, 0]} rotation={[-0.2, 0, -0.5]} geometry={SNOWMAN_TWIG_GEO} material={SNOWMAN_TWIG_MAT} />
        </group>
        <group ref={rightArmRef} position={[18, 26, 0]} rotation={[0, 0, 0.5]}>
          <mesh geometry={SNOWMAN_ARM_GEO} material={SNOWMAN_ARM_MAT} />
          <mesh position={[0, 4, 0]} rotation={[0.3, 0, -0.4]} geometry={SNOWMAN_TWIG_GEO} material={SNOWMAN_TWIG_MAT} />
          <mesh position={[0, -3, 0]} rotation={[-0.2, 0, 0.5]} geometry={SNOWMAN_TWIG_GEO} material={SNOWMAN_TWIG_MAT} />
        </group>
      </group>
    </EnemyBase>
  )
}
