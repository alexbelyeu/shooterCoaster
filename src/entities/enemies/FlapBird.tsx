import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { LEFT_BEHIND, backInFront, flyBackStep, leftBehind } from './leftBehind.hot'
import { setFlashMaterial } from './hitFlash'
import { useMarch } from './useMarch'
import { BIRD_EYE_MAT, CROW_FLINCH_MAT, createBirdFeatherMaterial, birdWingPose } from './SharedEnemyAssets'

/** Flap rates (radians of flap phase per game second) while hovering and in a dive. */
const CROW_FLAP_HOVER = 4.5
const CROW_FLAP_DIVE = 8

/** The rider's eye and look this frame (from the camera's world matrix), shared: one bird reads them at a time. */
const EYE = { x: 0, y: 0, z: 0 }
const LOOK = { x: 0, y: 0, z: -1 }

const tagFlinch = (mesh: THREE.Mesh | null) => {
  if (mesh) setFlashMaterial(mesh, CROW_FLINCH_MAT)
}

interface FlapBirdProps extends EnemyProps {
  /** Its feathers, painted, with the crow's wings (`aWing`), and its unlit eyes. */
  body: THREE.BufferGeometry
  eyes: THREE.BufferGeometry
}

/**
 * A bird with the crow's wings in two draw calls, feathers and eyes (the crow, the toucan); its wings flap in the
 * feather material's vertex shader. It takes turns hovering (slow flap, body bob) and diving (fast flap, nose down),
 * banking into its sway. A formation member the rider has gone past unshot flies back round in front of it (`LEFT_BEHIND`).
 */
export default function FlapBird({ body, eyes, ...props }: FlapBirdProps) {
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
  const facingRef = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)
  // Only a formation member flies in (`entry`): it was placed ahead of the rider for this stretch, and a scattered bird
  // may sit where the track comes back past it.
  const flock = props.entry !== undefined
  const behindFor = useRef(0)
  const flyingBack = useRef(false)
  // Where the rider's eye was last frame: a bird flying back outpaces the ride.
  const lastEye = useRef<THREE.Vector3 | null>(null)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      const wobble = Math.sin(time * 1.5) * 0.3
      const started = moving()
      let facing = moveAngle
      let rode = 0
      if (flock && started) {
        const m = camera.matrixWorld.elements
        EYE.x = m[12]
        EYE.y = m[13]
        EYE.z = m[14]
        LOOK.x = -m[8]
        LOOK.y = -m[9]
        LOOK.z = -m[10]
        const last = (lastEye.current ??= new THREE.Vector3(EYE.x, EYE.y, EYE.z))
        rode = Math.hypot(EYE.x - last.x, EYE.y - last.y, EYE.z - last.z)
        last.set(EYE.x, EYE.y, EYE.z)
        behindFor.current = leftBehind(mesh.position, EYE, LOOK) ? behindFor.current + delta : 0
        flyingBack.current = flyingBack.current ? !backInFront(mesh.position, EYE, LOOK) : behindFor.current >= LEFT_BEHIND.seconds
      }
      if (flyingBack.current) {
        facing = flyBackStep(mesh.position, EYE, LOOK, rode + LEFT_BEHIND.speed * dt)
      } else {
        const speed = started ? moveSpeed : 0
        mesh.position.x += (Math.cos(moveAngle) * speed + wobble) * dt
        mesh.position.z += (Math.sin(moveAngle) * speed + wobble * 0.5) * dt
      }
      mesh.position.y += Math.sin(time * 2 + flapOffset) * 0.05 * dt
      if (facingRef.current) facingRef.current.rotation.y = -facing + Math.PI / 2

      const dive = 0.5 + 0.5 * Math.sin(time * 0.7 + flapOffset)
      phase.current += delta * (CROW_FLAP_HOVER + (CROW_FLAP_DIVE - CROW_FLAP_HOVER) * dive)
      birdWingPose(phase.current, flap.value)

      const rig = rigRef.current
      if (rig) {
        rig.rotation.x = 0.1 + 0.25 * dive
        rig.rotation.z = -0.5 * sway * Math.cos(time * 1.5)
        // The body rises on each downstroke, most while hovering.
        rig.position.y = -0.35 * (1 - dive) * Math.cos(phase.current)
      }
    },
    [moveAngle, moveSpeed, moving, flapOffset, flap, sway, flock, camera],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={facingRef} scale={[8, 8, 8]} rotation={[0, -moveAngle + Math.PI / 2, 0]}>
        <group ref={rigRef}>
          <mesh ref={tagFlinch} geometry={body} material={featherMat} />
          <mesh geometry={eyes} material={BIRD_EYE_MAT} />
        </group>
      </group>
    </EnemyBase>
  )
}
