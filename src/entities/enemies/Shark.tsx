import { useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  SHARK_BODY_GEO, SHARK_SNOUT_GEO, SHARK_DORSAL_GEO,
  SHARK_TAIL_GEO, SHARK_PECTORAL_GEO, SHARK_EYE_GEO, SHARK_MOUTH_GEO,
  SHARK_BODY_MAT, SHARK_SNOUT_MAT, SHARK_FIN_MAT,
  SHARK_BELLY_MAT, SHARK_EYE_MAT, SHARK_MOUTH_MAT,
} from './SharedEnemyAssets'

/**
 * Multi-primitive shark with orbital movement and tail sway.
 * Stays at water level, swims in circular patterns.
 */
export default function Shark(props: EnemyProps) {
  const theta = useMemo(() => Math.random() * Math.PI + 0.3, [])
  const moveAngle = useMemo(() => Math.random() * Math.PI * 2, [])
  const tailRef = useRef<THREE.Group>(null)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      // Orbital movement (original pattern, slightly slower)
      mesh.position.z += ((3 * Math.cos(time * theta)) / theta) * dt
      mesh.position.x += ((3 * Math.sin(time * theta)) / theta) * dt
      // Keep at water surface
      mesh.position.y = 2

      // Tail sway
      if (tailRef.current) {
        tailRef.current.rotation.y = Math.sin(time * 4) * 0.3
      }
    },
    [theta],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group scale={[8, 8, 8]} rotation={[0, moveAngle, 0]}>
        {/* Body */}
        <mesh geometry={SHARK_BODY_GEO} material={SHARK_BODY_MAT} rotation={[0, 0, Math.PI / 2]} />

        {/* Belly (lighter underside) */}
        <mesh position={[0, -1.2, 0]} scale={[0.9, 0.6, 0.9]} geometry={SHARK_BODY_GEO} material={SHARK_BELLY_MAT} rotation={[0, 0, Math.PI / 2]} />

        {/* Snout */}
        <mesh position={[0, -0.3, 5]} geometry={SHARK_SNOUT_GEO} material={SHARK_SNOUT_MAT} rotation={[-Math.PI / 2, 0, 0]} />

        {/* Dorsal fin */}
        <mesh position={[0, 2.5, -0.5]} geometry={SHARK_DORSAL_GEO} material={SHARK_FIN_MAT} rotation={[0.2, 0, 0]} />

        {/* Tail group (animated sway) */}
        <group ref={tailRef} position={[0, 0, -4.5]}>
          {/* Upper tail lobe */}
          <mesh position={[0, 1.2, -1]} geometry={SHARK_TAIL_GEO} material={SHARK_FIN_MAT} rotation={[-0.4, 0, 0]} />
          {/* Lower tail lobe */}
          <mesh position={[0, -0.8, -0.8]} geometry={SHARK_TAIL_GEO} material={SHARK_FIN_MAT} rotation={[0.3, 0, 0]} scale={[1, 0.7, 0.7]} />
        </group>

        {/* Left pectoral fin */}
        <mesh position={[-2.2, -0.8, 1]} geometry={SHARK_PECTORAL_GEO} material={SHARK_FIN_MAT} rotation={[0, 0, -0.4]} />
        {/* Right pectoral fin */}
        <mesh position={[2.2, -0.8, 1]} geometry={SHARK_PECTORAL_GEO} material={SHARK_FIN_MAT} rotation={[0, 0, 0.4]} />

        {/* Eyes */}
        <mesh position={[-1.5, 0.5, 3.5]} geometry={SHARK_EYE_GEO} material={SHARK_EYE_MAT} />
        <mesh position={[1.5, 0.5, 3.5]} geometry={SHARK_EYE_GEO} material={SHARK_EYE_MAT} />

        {/* Mouth line */}
        <mesh position={[0, -1, 4]} geometry={SHARK_MOUTH_GEO} material={SHARK_MOUTH_MAT} />
      </group>
    </EnemyBase>
  )
}
