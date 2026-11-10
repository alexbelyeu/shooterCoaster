import { useCallback, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { WATER_Y } from '@/entities/spawning/enemyPlacement'
import { marchHeading } from '@/entities/spawning/spawnPlacement'
import {
  FFISH_BODY_GEO, FFISH_WING_GEO, FFISH_TAIL_UPPER_GEO, FFISH_TAIL_LOWER_GEO,
  FFISH_DORSAL_GEO, FFISH_EYE_GEO,
  FFISH_BODY_MAT, FFISH_BELLY_MAT, FFISH_WING_MAT,
  FFISH_TAIL_MAT, FFISH_FIN_MAT, FFISH_EYE_MAT,
} from './SharedEnemyAssets'

const GRAVITY = 0.08

/**
 * Overhauled flying fish: LatheGeometry body, swept-back wing-fins,
 * forked tail, dorsal fin. Leaps in parabolic arcs.
 * Wings spread when airborne, fold when submerged.
 */
export default function FlyingFish(props: EnemyProps) {
  // One speed for the whole school, or it strings out.
  const heading = marchHeading(props.motion)
  const own = useEnemyRandom(props.id, (rng) => ({
    angle: rng() * Math.PI * 2, speed: 0.8 + rng() * 0.5, launchSpeed: 1.5 + rng() * 1.0, rng,
  }))
  const moveAngle = heading ?? own.angle
  const moveSpeed = heading === undefined ? own.speed : 1
  const { launchSpeed, rng } = own
  const leftWingRef = useRef<THREE.Group>(null)
  const rightWingRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Group>(null)
  const vyRef = useRef(launchSpeed)
  const submergedTime = useRef(0)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      mesh.position.x += Math.cos(moveAngle) * moveSpeed * dt
      mesh.position.z += Math.sin(moveAngle) * moveSpeed * dt

      vyRef.current -= GRAVITY * dt
      mesh.position.y += vyRef.current * dt

      const inWater = mesh.position.y < WATER_Y

      if (inWater) {
        mesh.position.y = WATER_Y
        submergedTime.current += delta
        if (submergedTime.current > 0.3 + rng() * 0.4) {
          vyRef.current = launchSpeed * (0.8 + rng() * 0.4)
          submergedTime.current = 0
        } else {
          vyRef.current = 0
        }
      }

      // Wing-fins: spread when airborne, fold when in water
      const wingSpread = inWater ? 0.8 : 0
      if (leftWingRef.current) leftWingRef.current.rotation.z = wingSpread
      if (rightWingRef.current) rightWingRef.current.rotation.z = -wingSpread

      // Slight body pitch based on vertical velocity
      if (bodyRef.current) {
        bodyRef.current.rotation.x = THREE.MathUtils.clamp(vyRef.current * -0.15, -0.4, 0.4)
      }
    },
    [moveAngle, moveSpeed, launchSpeed],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={bodyRef} scale={[8, 8, 8]} rotation={[0, -moveAngle + Math.PI / 2, 0]}>
        {/* Body — lathe, rotated so length runs along Z */}
        <mesh
          geometry={FFISH_BODY_GEO}
          material={FFISH_BODY_MAT}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, -1]}
          scale={[1, 1, 0.7]}
        />

        {/* Belly — lighter underside */}
        <mesh
          geometry={FFISH_BODY_GEO}
          material={FFISH_BELLY_MAT}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, -0.4, -1]}
          scale={[0.8, 0.8, 0.4]}
        />

        {/* Left wing-fin */}
        <group ref={leftWingRef} position={[-1, 0, 0.5]}>
          <mesh geometry={FFISH_WING_GEO} material={FFISH_WING_MAT} scale={[-1, 1, 1]} />
        </group>

        {/* Right wing-fin */}
        <group ref={rightWingRef} position={[1, 0, 0.5]}>
          <mesh geometry={FFISH_WING_GEO} material={FFISH_WING_MAT} />
        </group>

        {/* Dorsal fin */}
        <mesh
          position={[0, 1.2, 0]}
          geometry={FFISH_DORSAL_GEO}
          material={FFISH_FIN_MAT}
        />

        {/* Tail — forked */}
        <group position={[0, 0, -3]}>
          <mesh geometry={FFISH_TAIL_UPPER_GEO} material={FFISH_TAIL_MAT} />
          <mesh geometry={FFISH_TAIL_LOWER_GEO} material={FFISH_TAIL_MAT} />
        </group>

        {/* Eyes */}
        <mesh position={[-0.6, 0.4, 2]} geometry={FFISH_EYE_GEO} material={FFISH_EYE_MAT} />
        <mesh position={[0.6, 0.4, 2]} geometry={FFISH_EYE_GEO} material={FFISH_EYE_MAT} />
      </group>
    </EnemyBase>
  )
}
