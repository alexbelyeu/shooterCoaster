import { useCallback, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  SHARK_BODY_GEO, SHARK_SNOUT_GEO, SHARK_DORSAL_GEO,
  SHARK_TAIL_UPPER_GEO, SHARK_TAIL_LOWER_GEO,
  SHARK_PECTORAL_GEO, SHARK_EYE_GEO, SHARK_MOUTH_GEO,
  SHARK_TOOTH_GEO, SHARK_GILL_GEO,
  SHARK_BODY_MAT, SHARK_SNOUT_MAT, SHARK_FIN_MAT,
  SHARK_BELLY_MAT, SHARK_EYE_MAT, SHARK_MOUTH_MAT, SHARK_TOOTH_MAT,
} from './SharedEnemyAssets'

/**
 * Overhauled shark: LatheGeometry torpedo body, custom swept-back fins,
 * crescent tail with sway animation, teeth, gill slits.
 * Always faces the camera for menacing presence.
 */
export default function Shark(props: EnemyProps) {
  const theta = useMemo(() => Math.random() * Math.PI + 0.3, [])
  const tailRef = useRef<THREE.Group>(null)
  const modelRef = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      mesh.position.z += ((3 * Math.cos(time * theta)) / theta) * dt
      mesh.position.x += ((3 * Math.sin(time * theta)) / theta) * dt
      mesh.position.y = 2

      // Tail sway
      if (tailRef.current) {
        tailRef.current.rotation.y = Math.sin(time * 4) * 0.3
      }
    },
    [theta],
  )

  // Face the camera each frame
  useFrame(() => {
    if (!modelRef.current?.parent) return
    const parent = modelRef.current.parent
    const dx = camera.position.x - parent.position.x
    const dz = camera.position.z - parent.position.z
    modelRef.current.rotation.y = Math.atan2(dx, dz)
  })

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={modelRef} scale={[10, 10, 10]}>
        {/* Body — lathe torpedo, rotated so length runs along Z */}
        <mesh
          geometry={SHARK_BODY_GEO}
          material={SHARK_BODY_MAT}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, -2]}
        />

        {/* Belly — lighter underside, slightly smaller */}
        <mesh
          geometry={SHARK_BODY_GEO}
          material={SHARK_BELLY_MAT}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, -1, -2]}
          scale={[0.85, 0.85, 0.55]}
        />

        {/* Snout */}
        <mesh
          position={[0, -0.3, 5.5]}
          geometry={SHARK_SNOUT_GEO}
          material={SHARK_SNOUT_MAT}
          rotation={[-Math.PI / 2, 0, 0]}
        />

        {/* Dorsal fin — tall swept triangle */}
        <mesh
          position={[0, 2.8, 0]}
          geometry={SHARK_DORSAL_GEO}
          material={SHARK_FIN_MAT}
        />

        {/* Tail group — crescent shape with sway */}
        <group ref={tailRef} position={[0, 0, -5]}>
          <mesh geometry={SHARK_TAIL_UPPER_GEO} material={SHARK_FIN_MAT} scale={[1, 1.2, 1.2]} />
          <mesh geometry={SHARK_TAIL_LOWER_GEO} material={SHARK_FIN_MAT} scale={[1, 1, 1]} />
        </group>

        {/* Left pectoral fin */}
        <mesh
          position={[-2.5, -0.8, 2]}
          geometry={SHARK_PECTORAL_GEO}
          material={SHARK_FIN_MAT}
          rotation={[0.1, 0.2, -0.3]}
          scale={[-1, 1, 1]}
        />
        {/* Right pectoral fin */}
        <mesh
          position={[2.5, -0.8, 2]}
          geometry={SHARK_PECTORAL_GEO}
          material={SHARK_FIN_MAT}
          rotation={[0.1, -0.2, 0.3]}
        />

        {/* Eyes — larger, menacing */}
        <mesh position={[-1.8, 0.8, 4.5]} geometry={SHARK_EYE_GEO} material={SHARK_EYE_MAT} />
        <mesh position={[1.8, 0.8, 4.5]} geometry={SHARK_EYE_GEO} material={SHARK_EYE_MAT} />

        {/* Mouth line */}
        <mesh position={[0, -1.2, 5]} geometry={SHARK_MOUTH_GEO} material={SHARK_MOUTH_MAT} />

        {/* Teeth — row of small cones along the mouth */}
        {[-0.8, -0.4, 0, 0.4, 0.8].map((xOff, i) => (
          <mesh
            key={`tooth-${i}`}
            position={[xOff, -1.05, 5.2]}
            geometry={SHARK_TOOTH_GEO}
            material={SHARK_TOOTH_MAT}
            rotation={[Math.PI, 0, 0]}
          />
        ))}

        {/* Gill slits — 3 per side */}
        {[-1, 1].map((side) =>
          [0, 0.6, 1.2].map((zOff, i) => (
            <mesh
              key={`gill-${side}-${i}`}
              position={[side * 2.4, 0, 3 - zOff]}
              geometry={SHARK_GILL_GEO}
              material={SHARK_MOUTH_MAT}
            />
          ))
        )}
      </group>
    </EnemyBase>
  )
}
