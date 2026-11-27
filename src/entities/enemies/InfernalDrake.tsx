import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { setFlashMaterial } from './hitFlash'
import { DRAKE_GEO, DRAKE_ROAR_MAT, createDrakeMaterial, drakeRestPose } from './SharedEnemyAssets'
import { poseDrake, type DrakePose } from './drakePose.hot'
import { DRAKE_FLEE } from './slipAway.hot'
import { useSlipAway } from './useSlipAway'

/** Wing beats (radians per game second); the hand trails the arm by `HAND_LAG`. */
const FLAP_RATE = 3
const HAND_LAG = 0.9
/** Bank into its circle (it always turns left, towards the orbit's centre). */
const BANK = 0.28

const tagRoar = (mesh: THREE.Mesh | null) => {
  if (mesh) setFlashMaterial(mesh, DRAKE_ROAR_MAT)
}

/**
 * A long-necked dragon (brief: docs/art/ENEMIES.md) circling high over the Inferno, in one draw call: torso, neck, jaw,
 * tail and each wing's arm and hand are one geometry, each part moved in the vertex shader by its own matrix
 * (`drakePose.hot.ts`). Its wings beat, the hands trailing, its neck sways and its tail swings; it banks into its
 * circle. Shot, it roars: its hit flash holds the head reared back, jaw open, wings thrown up (`DRAKE_ROAR_MAT`). One left
 * too long once seen climbs out of the frame (`DRAKE_FLEE`, #1059).
 */
export default function InfernalDrake(props: EnemyProps) {
  const { orbitSpeed, orbitRadius, orbitOffset, flapOffset } = useEnemyRandom(props.id, (rng) => ({
    orbitSpeed: 0.15 + rng() * 0.15,
    orbitRadius: 200 + rng() * 300,
    orbitOffset: rng() * Math.PI * 2,
    flapOffset: rng() * Math.PI * 2,
  }))

  const pose = useMemo(drakeRestPose, [])
  const material = useMemo(() => createDrakeMaterial(pose), [pose])
  useEffect(() => () => material.dispose(), [material])
  const joints = useRef<DrakePose>({ neckX: 0, neckY: 0, jaw: 0, tailX: 0, tailY: 0, arm: 0, hand: 0 })
  const headingRef = useRef<THREE.Group>(null)
  const rigRef = useRef<THREE.Group>(null)
  const flee = useSlipAway(DRAKE_FLEE)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, spawnPos: THREE.Vector3, time: number) => {
      const angle = time * orbitSpeed + orbitOffset
      mesh.position.x = spawnPos.x + Math.cos(angle) * orbitRadius
      mesh.position.z = spawnPos.z + Math.sin(angle) * orbitRadius
      mesh.position.y = spawnPos.y + Math.sin(time * 0.5) * 15
      const fled = flee(mesh.position, time)
      if (fled < 0) return 'escaped'
      mesh.position.y += fled

      // Nose along its circle.
      if (headingRef.current) headingRef.current.rotation.y = -angle

      const t = time * FLAP_RATE + flapOffset
      const rig = rigRef.current
      if (rig) {
        // The body lifts on each downstroke, and pitches with its climb.
        rig.position.y = -0.3 * Math.cos(t)
        rig.rotation.x = -0.12 * Math.cos(time * 0.5)
        rig.rotation.z = BANK
      }
      const j = joints.current
      j.arm = 0.55 * Math.sin(t)
      j.hand = 0.5 * Math.sin(t - HAND_LAG)
      j.neckX = 0.08 * Math.sin(t)
      j.neckY = 0.22 * Math.sin(time * 0.9 + flapOffset)
      j.jaw = 0.12 + 0.08 * Math.sin(time * 1.5)
      j.tailX = 0.1 * Math.sin(time * 1.2)
      j.tailY = 0.3 * Math.sin(time * 1.6 + flapOffset)
      poseDrake(pose.value, j)
    },
    [orbitSpeed, orbitRadius, orbitOffset, flapOffset, pose, flee],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={headingRef} scale={20}>
        <group ref={rigRef}>
          <mesh ref={tagRoar} geometry={DRAKE_GEO} material={material} />
        </group>
      </group>
    </EnemyBase>
  )
}
