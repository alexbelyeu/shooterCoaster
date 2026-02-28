import { useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  CROW_BODY_GEO, CROW_HEAD_GEO, CROW_BEAK_GEO,
  CROW_WING_GEO, CROW_TAIL_GEO, CROW_EYE_GEO,
  CROW_BODY_MAT, CROW_HEAD_MAT, CROW_BEAK_MAT,
  CROW_WING_MAT, CROW_TAIL_MAT, CROW_EYE_MAT,
} from './SharedEnemyAssets'

/**
 * Rebuilt crow: multi-primitive bird with flapping wings.
 * Movement: circling/drifting pattern with sine-wave wobble.
 */
export default function Crow(props: EnemyProps) {
  const moveAngle = useMemo(() => Math.random() * Math.PI * 2, [])
  const moveSpeed = useMemo(() => 0.4 + Math.random() * 0.6, [])
  const flapOffset = useMemo(() => Math.random() * Math.PI * 2, [])
  const leftWingRef = useRef<THREE.Mesh>(null)
  const rightWingRef = useRef<THREE.Mesh>(null)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      // Drift in a direction with gentle sine-wave wobble
      const wobble = Math.sin(time * 1.5) * 0.3
      mesh.position.x += (Math.cos(moveAngle) * moveSpeed + wobble) * dt
      mesh.position.z += (Math.sin(moveAngle) * moveSpeed + wobble * 0.5) * dt
      // Gentle vertical bobbing
      mesh.position.y += Math.sin(time * 2 + flapOffset) * 0.05 * dt

      // Flap wings
      const flapAngle = Math.sin((time * 8) + flapOffset) * 0.6
      if (leftWingRef.current) leftWingRef.current.rotation.z = flapAngle
      if (rightWingRef.current) rightWingRef.current.rotation.z = -flapAngle
    },
    [moveAngle, moveSpeed, flapOffset],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group scale={[6, 6, 6]} rotation={[0, -moveAngle + Math.PI / 2, 0]}>
        {/* Body */}
        <mesh geometry={CROW_BODY_GEO} material={CROW_BODY_MAT} rotation={[Math.PI / 2, 0, 0]} />

        {/* Head */}
        <mesh position={[0, 0.5, 3.5]} geometry={CROW_HEAD_GEO} material={CROW_HEAD_MAT} />

        {/* Beak */}
        <mesh position={[0, 0.3, 5.5]} geometry={CROW_BEAK_GEO} material={CROW_BEAK_MAT} rotation={[Math.PI / 2, 0, 0]} />

        {/* Left wing */}
        <mesh
          ref={leftWingRef}
          position={[-5, 0.5, 0]}
          geometry={CROW_WING_GEO}
          material={CROW_WING_MAT}
        />

        {/* Right wing */}
        <mesh
          ref={rightWingRef}
          position={[5, 0.5, 0]}
          geometry={CROW_WING_GEO}
          material={CROW_WING_MAT}
        />

        {/* Tail */}
        <mesh position={[0, 0.3, -3.5]} geometry={CROW_TAIL_GEO} material={CROW_TAIL_MAT} />

        {/* Eyes */}
        <mesh position={[-1, 1.2, 4]} geometry={CROW_EYE_GEO} material={CROW_EYE_MAT} />
        <mesh position={[1, 1.2, 4]} geometry={CROW_EYE_GEO} material={CROW_EYE_MAT} />
      </group>
    </EnemyBase>
  )
}
