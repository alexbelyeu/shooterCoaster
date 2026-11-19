import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { setFlashMaterial } from './hitFlash'
import { useMarch } from './useMarch'
import {
  CROW_EYE_MAT, CROW_EYES_GEO, CROW_FLINCH_MAT, CROW_GEO, createCrowFeatherMaterial, crowWingPose,
} from './SharedEnemyAssets'

/** Flap rates (radians of flap phase per game second) while hovering and in a dive. */
const CROW_FLAP_HOVER = 4.5
const CROW_FLAP_DIVE = 8

const tagFlinch = (mesh: THREE.Mesh | null) => {
  if (mesh) setFlashMaterial(mesh, CROW_FLINCH_MAT)
}

/**
 * A desert raven in two draw calls, feathers and eyes; its wings flap in the feather material's vertex shader.
 * It takes turns hovering (slow flap, body bob) and diving (fast flap, nose down), banking into its sway.
 */
export default function Crow(props: EnemyProps) {
  // One speed for the whole flock, or its V stretches apart.
  const { heading, moving } = useMarch(props.motion)
  const own = useEnemyRandom(props.id, (rng) => ({
    angle: rng() * Math.PI * 2, speed: 0.4 + rng() * 0.6, flapOffset: rng() * Math.PI * 2,
  }))
  const moveAngle = heading ?? own.angle
  const moveSpeed = heading === undefined ? own.speed : 0.7
  const { flapOffset } = own
  // The sway's share across the crow's heading (local +x): its bank follows it.
  const sway = Math.sin(moveAngle) - 0.5 * Math.cos(moveAngle)
  const flap = useMemo(() => ({ value: new THREE.Vector2() }), [])
  const featherMat = useMemo(() => createCrowFeatherMaterial(flap), [flap])
  useEffect(() => () => featherMat.dispose(), [featherMat])
  const rigRef = useRef<THREE.Group>(null)
  const phase = useRef(flapOffset)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      const wobble = Math.sin(time * 1.5) * 0.3
      const speed = moving() ? moveSpeed : 0
      mesh.position.x += (Math.cos(moveAngle) * speed + wobble) * dt
      mesh.position.z += (Math.sin(moveAngle) * speed + wobble * 0.5) * dt
      mesh.position.y += Math.sin(time * 2 + flapOffset) * 0.05 * dt

      const dive = 0.5 + 0.5 * Math.sin(time * 0.7 + flapOffset)
      phase.current += delta * (CROW_FLAP_HOVER + (CROW_FLAP_DIVE - CROW_FLAP_HOVER) * dive)
      crowWingPose(phase.current, flap.value)

      const rig = rigRef.current
      if (rig) {
        rig.rotation.x = 0.1 + 0.25 * dive
        rig.rotation.z = -0.5 * sway * Math.cos(time * 1.5)
        // The body rises on each downstroke, most while hovering.
        rig.position.y = -0.35 * (1 - dive) * Math.cos(phase.current)
      }
    },
    [moveAngle, moveSpeed, moving, flapOffset, flap, sway],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group scale={[8, 8, 8]} rotation={[0, -moveAngle + Math.PI / 2, 0]}>
        <group ref={rigRef}>
          <mesh ref={tagFlinch} geometry={CROW_GEO} material={featherMat} />
          <mesh geometry={CROW_EYES_GEO} material={CROW_EYE_MAT} />
        </group>
      </group>
    </EnemyBase>
  )
}
