import { useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  CROW_BODY_GEO, CROW_HEAD_GEO, CROW_BEAK_UPPER_GEO, CROW_BEAK_LOWER_GEO,
  CROW_WING_INNER_GEO, CROW_WING_OUTER_GEO, CROW_TAIL_GEO,
  CROW_BREAST_GEO, CROW_EYE_GEO,
  CROW_BODY_MAT, CROW_HEAD_MAT, CROW_BEAK_MAT,
  CROW_WING_MAT, CROW_TAIL_MAT, CROW_BREAST_MAT, CROW_EYE_MAT,
} from './SharedEnemyAssets'

/**
 * Rebuilt crow: iridescent multi-primitive bird with 2-joint articulated wing flap.
 * LatheGeometry body, custom BufferGeometry wings, tail feather fan.
 */
export default function Crow(props: EnemyProps) {
  const moveAngle = useMemo(() => Math.random() * Math.PI * 2, [])
  const moveSpeed = useMemo(() => 0.4 + Math.random() * 0.6, [])
  const flapOffset = useMemo(() => Math.random() * Math.PI * 2, [])
  const leftWingInnerRef = useRef<THREE.Group>(null)
  const leftWingOuterRef = useRef<THREE.Group>(null)
  const rightWingInnerRef = useRef<THREE.Group>(null)
  const rightWingOuterRef = useRef<THREE.Group>(null)
  const bodyGroupRef = useRef<THREE.Group>(null)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      const wobble = Math.sin(time * 1.5) * 0.3
      mesh.position.x += (Math.cos(moveAngle) * moveSpeed + wobble) * dt
      mesh.position.z += (Math.sin(moveAngle) * moveSpeed + wobble * 0.5) * dt
      mesh.position.y += Math.sin(time * 2 + flapOffset) * 0.05 * dt

      // 2-joint articulated flap: inner leads, outer trails with phase delay
      const t = time * 5 + flapOffset
      const innerFlap = Math.sin(t) * 0.5
      const outerFlap = Math.sin(t + 0.5) * 0.4

      if (leftWingInnerRef.current) leftWingInnerRef.current.rotation.z = innerFlap
      if (leftWingOuterRef.current) leftWingOuterRef.current.rotation.z = outerFlap
      if (rightWingInnerRef.current) rightWingInnerRef.current.rotation.z = -innerFlap
      if (rightWingOuterRef.current) rightWingOuterRef.current.rotation.z = -outerFlap

      // Subtle body roll
      if (bodyGroupRef.current) {
        bodyGroupRef.current.rotation.z = Math.sin(t) * 0.08
      }
    },
    [moveAngle, moveSpeed, flapOffset],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={bodyGroupRef} scale={[8, 8, 8]} rotation={[0, -moveAngle + Math.PI / 2, 0]}>
        {/* Body — lathe, rotated so length runs along Z */}
        <mesh
          geometry={CROW_BODY_GEO}
          material={CROW_BODY_MAT}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, -1]}
        />

        {/* Breast — lighter, overlaps front of body */}
        <mesh
          geometry={CROW_BREAST_GEO}
          material={CROW_BREAST_MAT}
          position={[0, -0.5, 1]}
          scale={[0.85, 0.85, 1]}
        />

        {/* Head — slightly forward-tapered */}
        <mesh
          position={[0, 1, 4]}
          geometry={CROW_HEAD_GEO}
          material={CROW_HEAD_MAT}
          scale={[0.9, 1, 1.1]}
        />

        {/* Beak — upper mandible (longer) */}
        <mesh
          position={[0, 0.6, 6.5]}
          geometry={CROW_BEAK_UPPER_GEO}
          material={CROW_BEAK_MAT}
          rotation={[Math.PI / 2, 0, 0]}
        />
        {/* Beak — lower mandible (shorter, slightly open) */}
        <mesh
          position={[0, 0.1, 6]}
          geometry={CROW_BEAK_LOWER_GEO}
          material={CROW_BEAK_MAT}
          rotation={[Math.PI / 2 + 0.15, 0, 0]}
        />

        {/* Eyes */}
        <mesh position={[-1.2, 1.8, 5]} geometry={CROW_EYE_GEO} material={CROW_EYE_MAT} />
        <mesh position={[1.2, 1.8, 5]} geometry={CROW_EYE_GEO} material={CROW_EYE_MAT} />

        {/* Left wing — inner (pivot at shoulder) */}
        <group ref={leftWingInnerRef} position={[-2.5, 0.5, 0]}>
          <mesh geometry={CROW_WING_INNER_GEO} material={CROW_WING_MAT} scale={[-1, 1, 1]} />
          {/* Outer wing (pivot at elbow) */}
          <group ref={leftWingOuterRef} position={[-5, 0, 0]}>
            <mesh geometry={CROW_WING_OUTER_GEO} material={CROW_WING_MAT} scale={[-1, 1, 1]} />
          </group>
        </group>

        {/* Right wing — inner (pivot at shoulder) */}
        <group ref={rightWingInnerRef} position={[2.5, 0.5, 0]}>
          <mesh geometry={CROW_WING_INNER_GEO} material={CROW_WING_MAT} />
          {/* Outer wing (pivot at elbow) */}
          <group ref={rightWingOuterRef} position={[5, 0, 0]}>
            <mesh geometry={CROW_WING_OUTER_GEO} material={CROW_WING_MAT} />
          </group>
        </group>

        {/* Tail fan — 5 feathers spread at angles */}
        {[-0.4, -0.2, 0, 0.2, 0.4].map((angle, i) => (
          <mesh
            key={`tail-${i}`}
            position={[Math.sin(angle) * 1.5, 0.3, -4.5 - Math.abs(angle) * 1.5]}
            geometry={CROW_TAIL_GEO}
            material={CROW_TAIL_MAT}
            rotation={[0.1, angle, 0]}
          />
        ))}
      </group>
    </EnemyBase>
  )
}
