import { useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  DRAKE_BODY_GEO, DRAKE_HEAD_GEO, DRAKE_SPIKE_GEO,
  DRAKE_TAIL_GEO, DRAKE_WING_GEO, DRAKE_EYE_GEO, DRAKE_JAW_GEO,
  DRAKE_BODY_MAT, DRAKE_WING_MAT, DRAKE_SPIKE_MAT, DRAKE_EYE_MAT,
} from './SharedEnemyAssets'

/**
 * Large flying dragon enemy. Slow circling flight at high altitude.
 * Multi-joint wing flap, tail undulation, jaw open/close.
 */
export default function InfernalDrake(props: EnemyProps) {
  const orbitSpeed = useMemo(() => 0.15 + Math.random() * 0.15, [])
  const orbitRadius = useMemo(() => 200 + Math.random() * 300, [])
  const orbitOffset = useMemo(() => Math.random() * Math.PI * 2, [])
  const flapOffset = useMemo(() => Math.random() * Math.PI * 2, [])

  const leftWingInnerRef = useRef<THREE.Group>(null)
  const leftWingOuterRef = useRef<THREE.Group>(null)
  const rightWingInnerRef = useRef<THREE.Group>(null)
  const rightWingOuterRef = useRef<THREE.Group>(null)
  const tailRef = useRef<THREE.Mesh>(null)
  const jawRef = useRef<THREE.Mesh>(null)
  const bodyGroupRef = useRef<THREE.Group>(null)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, spawnPos: THREE.Vector3, time: number, delta: number) => {
      // Gradual orbit around spawn point
      const angle = time * orbitSpeed + orbitOffset
      mesh.position.x = spawnPos.x + Math.cos(angle) * orbitRadius
      mesh.position.z = spawnPos.z + Math.sin(angle) * orbitRadius
      mesh.position.y = spawnPos.y + Math.sin(time * 0.5) * 15

      // Face movement direction
      if (bodyGroupRef.current) {
        bodyGroupRef.current.rotation.y = -angle + Math.PI / 2
      }

      // Wing flap — inner leads, outer trails
      const t = time * 3 + flapOffset
      const innerFlap = Math.sin(t) * 0.6
      const outerFlap = Math.sin(t + 0.8) * 0.5

      if (leftWingInnerRef.current) leftWingInnerRef.current.rotation.z = innerFlap
      if (leftWingOuterRef.current) leftWingOuterRef.current.rotation.z = outerFlap
      if (rightWingInnerRef.current) rightWingInnerRef.current.rotation.z = -innerFlap
      if (rightWingOuterRef.current) rightWingOuterRef.current.rotation.z = -outerFlap

      // Tail undulation
      if (tailRef.current) {
        tailRef.current.rotation.x = Math.sin(time * 2) * 0.15
        tailRef.current.rotation.z = Math.sin(time * 1.5) * 0.1
      }

      // Jaw open/close
      if (jawRef.current) {
        jawRef.current.rotation.x = Math.sin(time * 1.5) * 0.1 + 0.1
      }
    },
    [orbitSpeed, orbitRadius, orbitOffset, flapOffset],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={bodyGroupRef} scale={[20, 20, 20]}>
        {/* Body — serpentine dragon, rotated so length runs along Z */}
        <mesh
          geometry={DRAKE_BODY_GEO}
          material={DRAKE_BODY_MAT}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, -3]}
        />

        {/* Head */}
        <mesh
          position={[0, 1.5, 6]}
          geometry={DRAKE_HEAD_GEO}
          material={DRAKE_BODY_MAT}
          scale={[1.2, 1, 1.3]}
        />

        {/* Eyes */}
        <mesh position={[-1.5, 2.5, 7.5]} geometry={DRAKE_EYE_GEO} material={DRAKE_EYE_MAT} />
        <mesh position={[1.5, 2.5, 7.5]} geometry={DRAKE_EYE_GEO} material={DRAKE_EYE_MAT} />

        {/* Jaw */}
        <mesh
          ref={jawRef}
          position={[0, 0.2, 7.5]}
          geometry={DRAKE_JAW_GEO}
          material={DRAKE_BODY_MAT}
        />

        {/* Head spikes */}
        <mesh position={[0, 4, 5.5]} geometry={DRAKE_SPIKE_GEO} material={DRAKE_SPIKE_MAT} />
        <mesh position={[-1.5, 3.5, 5]} rotation={[0, 0, -0.2]} geometry={DRAKE_SPIKE_GEO} material={DRAKE_SPIKE_MAT} />
        <mesh position={[1.5, 3.5, 5]} rotation={[0, 0, 0.2]} geometry={DRAKE_SPIKE_GEO} material={DRAKE_SPIKE_MAT} />

        {/* Spine ridge spikes */}
        {[0, -2, -4, -6].map((zOff, i) => (
          <mesh
            key={`spine-${i}`}
            position={[0, 3 - i * 0.3, zOff]}
            geometry={DRAKE_SPIKE_GEO}
            material={DRAKE_SPIKE_MAT}
            scale={[0.6, 0.8, 0.6]}
          />
        ))}

        {/* Left wing — inner (pivot at shoulder) */}
        <group ref={leftWingInnerRef} position={[-3, 1.5, 0]}>
          <mesh geometry={DRAKE_WING_GEO} material={DRAKE_WING_MAT} scale={[-1, 1, 1]} />
          {/* Outer wing (pivot at elbow) */}
          <group ref={leftWingOuterRef} position={[-8, 0, 0]}>
            <mesh geometry={DRAKE_WING_GEO} material={DRAKE_WING_MAT} scale={[-0.8, 0.8, 0.8]} />
          </group>
        </group>

        {/* Right wing — inner (pivot at shoulder) */}
        <group ref={rightWingInnerRef} position={[3, 1.5, 0]}>
          <mesh geometry={DRAKE_WING_GEO} material={DRAKE_WING_MAT} />
          {/* Outer wing (pivot at elbow) */}
          <group ref={rightWingOuterRef} position={[8, 0, 0]}>
            <mesh geometry={DRAKE_WING_GEO} material={DRAKE_WING_MAT} scale={[0.8, 0.8, 0.8]} />
          </group>
        </group>

        {/* Tail */}
        <mesh
          ref={tailRef}
          position={[0, 0, -9]}
          geometry={DRAKE_TAIL_GEO}
          material={DRAKE_BODY_MAT}
          rotation={[Math.PI / 2 + 0.2, 0, 0]}
        />
      </group>
    </EnemyBase>
  )
}
