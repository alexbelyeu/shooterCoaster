import { useCallback, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import {
  DRAKE_BODY_GEO, DRAKE_ELBOW, DRAKE_JAW_GEO, DRAKE_JAW_HINGE, DRAKE_MAT, DRAKE_NECK_GEO, DRAKE_NECK_ROOT,
  DRAKE_SHOULDER, DRAKE_TAIL_GEO, DRAKE_TAIL_ROOT, DRAKE_WING_ARM_GEO, DRAKE_WING_HAND_GEO,
} from './SharedEnemyAssets'

/** Wing beats (radians per game second); the hand trails the arm by `HAND_LAG`. */
const FLAP_RATE = 3
const HAND_LAG = 0.9
/** Bank into its circle (it always turns left, towards the orbit's centre). */
const BANK = 0.28

/** Both wings' moving parts: the right one, and the left one mirrored by its parent. */
type WingRefs = { arm: THREE.Mesh | null, hand: THREE.Mesh | null }

function poseWings(wings: WingRefs[], arm: number, hand: number) {
  for (const w of wings) {
    if (w.arm) w.arm.rotation.z = arm
    if (w.hand) w.hand.rotation.z = hand
  }
}

/**
 * A long-necked dragon (brief: docs/art/ENEMIES.md) circling high over the Inferno, in eight draw calls of one
 * material: torso, neck, jaw, tail and each wing's arm and hand. Its wings beat, the hands trailing, its neck sways and
 * its tail swings; it banks into its circle. Shot, it roars: head reared back, jaw open, wings thrown up.
 */
export default function InfernalDrake(props: EnemyProps) {
  const { orbitSpeed, orbitRadius, orbitOffset, flapOffset } = useEnemyRandom(props.id, (rng) => ({
    orbitSpeed: 0.15 + rng() * 0.15,
    orbitRadius: 200 + rng() * 300,
    orbitOffset: rng() * Math.PI * 2,
    flapOffset: rng() * Math.PI * 2,
  }))

  const headingRef = useRef<THREE.Group>(null)
  const rigRef = useRef<THREE.Group>(null)
  const neckRef = useRef<THREE.Mesh>(null)
  const jawRef = useRef<THREE.Mesh>(null)
  const tailRef = useRef<THREE.Mesh>(null)
  const wings = useRef<[WingRefs, WingRefs]>([{ arm: null, hand: null }, { arm: null, hand: null }])

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, spawnPos: THREE.Vector3, time: number) => {
      const angle = time * orbitSpeed + orbitOffset
      mesh.position.x = spawnPos.x + Math.cos(angle) * orbitRadius
      mesh.position.z = spawnPos.z + Math.sin(angle) * orbitRadius
      mesh.position.y = spawnPos.y + Math.sin(time * 0.5) * 15

      // Nose along its circle.
      if (headingRef.current) headingRef.current.rotation.y = -angle

      const t = time * FLAP_RATE + flapOffset
      poseWings(wings.current, 0.55 * Math.sin(t), 0.5 * Math.sin(t - HAND_LAG))
      const rig = rigRef.current
      if (rig) {
        // The body lifts on each downstroke, and pitches with its climb.
        rig.position.y = -0.3 * Math.cos(t)
        rig.rotation.x = -0.12 * Math.cos(time * 0.5)
        rig.rotation.z = BANK
      }
      if (neckRef.current) neckRef.current.rotation.set(0.08 * Math.sin(t), 0.22 * Math.sin(time * 0.9 + flapOffset), 0)
      if (jawRef.current) jawRef.current.rotation.x = 0.12 + 0.08 * Math.sin(time * 1.5)
      if (tailRef.current) tailRef.current.rotation.set(0.1 * Math.sin(time * 1.2), 0.3 * Math.sin(time * 1.6 + flapOffset), 0)
    },
    [orbitSpeed, orbitRadius, orbitOffset, flapOffset],
  )

  const onHit = useCallback(() => {
    neckRef.current?.rotation.set(-0.55, 0, 0)
    jawRef.current?.rotation.set(0.75, 0, 0)
    tailRef.current?.rotation.set(0.4, 0, 0)
    poseWings(wings.current, 0.9, 0.6)
  }, [])

  const wing = (side: 0 | 1) => (
    <group scale-x={side ? 1 : -1}>
      <mesh
        ref={(m) => { wings.current[side].arm = m }}
        position={DRAKE_SHOULDER}
        geometry={DRAKE_WING_ARM_GEO}
        material={DRAKE_MAT}
      >
        <mesh ref={(m) => { wings.current[side].hand = m }} position={DRAKE_ELBOW} geometry={DRAKE_WING_HAND_GEO} material={DRAKE_MAT} />
      </mesh>
    </group>
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition} onHit={onHit}>
      <group ref={headingRef} scale={20}>
        <group ref={rigRef}>
          <mesh geometry={DRAKE_BODY_GEO} material={DRAKE_MAT} />
          <mesh ref={neckRef} position={DRAKE_NECK_ROOT} geometry={DRAKE_NECK_GEO} material={DRAKE_MAT}>
            <mesh ref={jawRef} position={DRAKE_JAW_HINGE} geometry={DRAKE_JAW_GEO} material={DRAKE_MAT} />
          </mesh>
          <mesh ref={tailRef} position={DRAKE_TAIL_ROOT} geometry={DRAKE_TAIL_GEO} material={DRAKE_MAT} />
          {wing(0)}
          {wing(1)}
        </group>
      </group>
    </EnemyBase>
  )
}
