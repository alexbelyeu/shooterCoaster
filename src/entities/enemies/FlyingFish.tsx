import { useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  FFISH_BODY_GEO, FFISH_WING_GEO, FFISH_TAIL_GEO, FFISH_EYE_GEO,
  FFISH_BODY_MAT, FFISH_WING_MAT, FFISH_TAIL_MAT, FFISH_EYE_MAT,
} from './SharedEnemyAssets'

const GRAVITY = 0.08
const WATER_Y = 0

/**
 * Sleek flying fish that leaps in parabolic arcs from the water.
 * Fast-moving, harder to hit. Wing-fins spread when airborne.
 */
export default function FlyingFish(props: EnemyProps) {
  const moveAngle = useMemo(() => Math.random() * Math.PI * 2, [])
  const moveSpeed = useMemo(() => 0.8 + Math.random() * 0.5, [])
  const launchSpeed = useMemo(() => 1.5 + Math.random() * 1.0, [])
  const leftWingRef = useRef<THREE.Mesh>(null)
  const rightWingRef = useRef<THREE.Mesh>(null)
  const vyRef = useRef(launchSpeed)
  const submergedTime = useRef(0)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, spawnPos: THREE.Vector3, _time: number, delta: number) => {
      const dt = delta * 60
      // Horizontal drift
      mesh.position.x += Math.cos(moveAngle) * moveSpeed * dt
      mesh.position.z += Math.sin(moveAngle) * moveSpeed * dt

      // Vertical: parabolic arc
      vyRef.current -= GRAVITY * dt
      mesh.position.y += vyRef.current * dt

      const inWater = mesh.position.y < WATER_Y

      if (inWater) {
        // Brief time underwater before next leap
        mesh.position.y = WATER_Y
        submergedTime.current += delta
        if (submergedTime.current > 0.3 + Math.random() * 0.4) {
          // Relaunch
          vyRef.current = launchSpeed * (0.8 + Math.random() * 0.4)
          submergedTime.current = 0
        } else {
          vyRef.current = 0
        }
      }

      // Wing-fins spread when airborne, fold when in water
      const wingAngle = inWater ? 0.8 : 0
      if (leftWingRef.current) leftWingRef.current.rotation.z = -wingAngle
      if (rightWingRef.current) rightWingRef.current.rotation.z = wingAngle
    },
    [moveAngle, moveSpeed, launchSpeed],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group scale={[6, 6, 6]} rotation={[0, -moveAngle + Math.PI / 2, 0]}>
        {/* Body */}
        <mesh geometry={FFISH_BODY_GEO} material={FFISH_BODY_MAT} rotation={[0, 0, Math.PI / 2]} />

        {/* Left wing-fin */}
        <mesh
          ref={leftWingRef}
          position={[-1.8, 0.2, 0]}
          geometry={FFISH_WING_GEO}
          material={FFISH_WING_MAT}
        />

        {/* Right wing-fin */}
        <mesh
          ref={rightWingRef}
          position={[1.8, 0.2, 0]}
          geometry={FFISH_WING_GEO}
          material={FFISH_WING_MAT}
        />

        {/* Tail (V-shape) */}
        <mesh position={[0.3, 0, -2.5]} geometry={FFISH_TAIL_GEO} material={FFISH_TAIL_MAT} rotation={[0, 0, -0.3]} />
        <mesh position={[-0.3, 0, -2.5]} geometry={FFISH_TAIL_GEO} material={FFISH_TAIL_MAT} rotation={[0, 0, 0.3]} />

        {/* Eyes */}
        <mesh position={[-0.7, 0.4, 1.5]} geometry={FFISH_EYE_GEO} material={FFISH_EYE_MAT} />
        <mesh position={[0.7, 0.4, 1.5]} geometry={FFISH_EYE_GEO} material={FFISH_EYE_MAT} />
      </group>
    </EnemyBase>
  )
}
