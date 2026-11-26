import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { flyBack } from './leftBehind.hot'
import { useGameStore } from '@/store/useGameStore'
import { setFlashMaterial } from './hitFlash'
import { useMarch } from './useMarch'
import { BIRD_EYE_MAT, CROW_FLINCH_MAT, createBirdFeatherMaterial, birdWingPose } from './SharedEnemyAssets'

/** Flap rates (radians of flap phase per game second) while hovering and in a dive. */
const CROW_FLAP_HOVER = 4.5
const CROW_FLAP_DIVE = 8

/** The rider's look this frame, shared: one bird reads it at a time. */
const LOOK = new THREE.Vector3()

const tagFlinch = (mesh: THREE.Mesh | null) => {
  if (mesh) setFlashMaterial(mesh, CROW_FLINCH_MAT)
}

type FlapBirdProps = EnemyProps & (
  | {
      /** Its feathers, painted, with the crow's wings (`aWing`), and its unlit eyes. */
      body: THREE.BufferGeometry
      eyes: THREE.BufferGeometry
    }
  | {
      /** A rigged model in their place (the Blender crow, `BlenderCrow.tsx`), posed by `pose` from the flap phase each frame. */
      model: ReactNode
      pose: (phase: number) => void
      onHit?: () => void
    }
)

/**
 * A bird with the crow's wings in two draw calls, feathers and eyes (the crow, the toucan); its wings flap in the
 * feather material's vertex shader. It takes turns hovering (slow flap, body bob) and diving (fast flap, nose down),
 * banking into its sway. One the rider has gone past unshot flies back round in front of it (`flyBack`; every crow and toucan
 * flies in a formation wave, placed ahead of the rider for that stretch alone).
 */
export default function FlapBird(props: FlapBirdProps) {
  const pose = 'model' in props ? props.pose : undefined
  // One speed for the whole flock, or its V stretches apart.
  const { heading, moving } = useMarch(props.motion)
  const own = useEnemyRandom(props.id, (rng) => ({
    angle: rng() * Math.PI * 2, speed: 0.4 + rng() * 0.6, flapOffset: rng() * Math.PI * 2,
  }))
  const moveAngle = heading ?? own.angle
  const moveSpeed = heading === undefined ? own.speed : 0.7
  const { flapOffset } = own
  // The sway's share across the bird's heading (local +x): its bank follows it.
  const sway = Math.sin(moveAngle) - 0.5 * Math.cos(moveAngle)
  const flap = useMemo(() => ({ value: new THREE.Vector2() }), [])
  const featherMat = useMemo(() => createBirdFeatherMaterial(flap), [flap])
  useEffect(() => () => featherMat.dispose(), [featherMat])
  const rigRef = useRef<THREE.Group>(null)
  const phase = useRef(flapOffset)
  const camera = useThree((s) => s.camera)
  // Its fly-back state, and where the rider's eye was last frame: a bird flying back outpaces the ride.
  const back = useMemo(() => ({ flying: false, lastEye: camera.position.clone() }), [camera])

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      const wobble = Math.sin(time * 1.5) * 0.3
      const rode = back.lastEye.distanceTo(camera.position)
      back.lastEye.copy(camera.position)
      // None starts back during the boss fight: the rider's shots belong to the boss then.
      const game = useGameStore.getState()
      const facing = flyBack(back, mesh.position, camera.position, camera.getWorldDirection(LOOK), delta, rode, game.bossArrivedAt === null || game.bossSeconds !== null) ?? moveAngle
      if (!back.flying) {
        const speed = moving() ? moveSpeed : 0
        mesh.position.x += (Math.cos(moveAngle) * speed + wobble) * dt
        mesh.position.z += (Math.sin(moveAngle) * speed + wobble * 0.5) * dt
      }
      mesh.position.y += Math.sin(time * 2 + flapOffset) * 0.05 * dt
      // Its model faces `moveAngle`: the base turns it to the heading it flies back on.
      mesh.rotation.y = moveAngle - facing

      const dive = 0.5 + 0.5 * Math.sin(time * 0.7 + flapOffset)
      phase.current += delta * (CROW_FLAP_HOVER + (CROW_FLAP_DIVE - CROW_FLAP_HOVER) * dive)
      if (pose) pose(phase.current)
      else birdWingPose(phase.current, flap.value)

      const rig = rigRef.current
      if (rig) {
        rig.rotation.x = 0.1 + 0.25 * dive
        rig.rotation.z = -0.5 * sway * Math.cos(time * 1.5)
        // The body rises on each downstroke, most while hovering.
        rig.position.y = -0.35 * (1 - dive) * Math.cos(phase.current)
      }
    },
    [moveAngle, moveSpeed, moving, flapOffset, flap, sway, camera, back, pose],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition} onHit={'model' in props ? props.onHit : undefined}>
      <group scale={[8, 8, 8]} rotation={[0, -moveAngle + Math.PI / 2, 0]}>
        <group ref={rigRef}>
          {'model' in props ? props.model : (
            <>
              <mesh ref={tagFlinch} geometry={props.body} material={featherMat} />
              <mesh geometry={props.eyes} material={BIRD_EYE_MAT} />
            </>
          )}
        </group>
      </group>
    </EnemyBase>
  )
}
