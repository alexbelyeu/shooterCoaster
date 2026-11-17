import { useCallback, useContext, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { setFlashMaterial } from './hitFlash'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import {
  LAVA_GOLEM_BODY_GEO, LAVA_GOLEM_FLARE_MAT, LAVA_GOLEM_GLOW, LAVA_GOLEM_HIP, LAVA_GOLEM_LEFT_ARM_GEO,
  LAVA_GOLEM_LEG_GEO, LAVA_GOLEM_MAT, LAVA_GOLEM_RIGHT_ARM_GEO, LAVA_GOLEM_SHOULDER,
} from './SharedEnemyAssets'

/** Stride (radians of walk phase per game second: a step every half cycle), and the legs' and arms' swing (radians). */
const STRIDE_RATE = 2.2
const LEG_SWING = 0.4
const ARM_SWING = 0.45

const [HIP_X, HIP_Y, HIP_Z] = LAVA_GOLEM_HIP
const [SHOULDER_X, SHOULDER_Y, SHOULDER_Z] = LAVA_GOLEM_SHOULDER

/** On a hit its seams flare white-hot instead of the white flash. */
const tagFlare = (o: THREE.Object3D) => {
  if ((o as THREE.Mesh).isMesh) setFlashMaterial(o as THREE.Mesh, LAVA_GOLEM_FLARE_MAT)
}

/**
 * A hulking cracked-rock brute on legs (brief: docs/art/ENEMIES.md), turned to the rider: a slow, heavy two-step
 * walk, dropping onto each foot and leaning over it, arms swinging against the legs, its lava seams pulsing.
 * Five draw calls (body, two legs, two arms), one material and program.
 */
export default function LavaGolem(props: EnemyProps) {
  const { theta, moveSpeed, stepOffset } = useEnemyRandom(props.id, (rng) => ({
    theta: 0.3 + rng() * 0.8, moveSpeed: 0.8 + rng() * 1.0, stepOffset: rng() * Math.PI * 2,
  }))
  const modelRef = useRef<THREE.Group>(null)
  const rigRef = useRef<THREE.Group>(null)
  const leftLegRef = useRef<THREE.Mesh>(null)
  const rightLegRef = useRef<THREE.Mesh>(null)
  const leftArmRef = useRef<THREE.Mesh>(null)
  const rightArmRef = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  const heightFn = useContext(TerrainContext)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      mesh.position.z += ((moveSpeed * Math.cos(time * theta)) / theta) * dt
      mesh.position.x += ((moveSpeed * Math.sin(time * theta)) / theta) * dt
      mesh.position.y = heightFn(mesh.position.x, mesh.position.z) + 2

      LAVA_GOLEM_GLOW.value = 1.8 + 0.7 * Math.sin(time * 2.6)

      const step = Math.sin(time * STRIDE_RATE + stepOffset)
      const rig = rigRef.current
      if (rig) {
        // Lowest mid-stride, with its weight over the leading foot.
        rig.position.y = -0.6 * Math.abs(step)
        rig.rotation.set(0.08, 0.08 * step, 0.07 * step)
      }
      if (leftLegRef.current) leftLegRef.current.rotation.x = LEG_SWING * step
      if (rightLegRef.current) rightLegRef.current.rotation.x = -LEG_SWING * step
      if (leftArmRef.current) leftArmRef.current.rotation.x = -ARM_SWING * step
      if (rightArmRef.current) rightArmRef.current.rotation.x = ARM_SWING * step
    },
    [theta, moveSpeed, stepOffset, heightFn],
  )

  useEffect(() => modelRef.current?.traverse(tagFlare), [])

  useFrame(() => {
    const model = modelRef.current
    if (!model?.parent) return
    model.rotation.y = Math.atan2(camera.position.x - model.parent.position.x, camera.position.z - model.parent.position.z)
  })

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={modelRef} scale={[9, 9, 9]}>
        <group ref={rigRef}>
          <mesh geometry={LAVA_GOLEM_BODY_GEO} material={LAVA_GOLEM_MAT} />
          <mesh ref={leftLegRef} position={[-HIP_X, HIP_Y, HIP_Z]} geometry={LAVA_GOLEM_LEG_GEO} material={LAVA_GOLEM_MAT} />
          <mesh ref={rightLegRef} position={[HIP_X, HIP_Y, HIP_Z]} geometry={LAVA_GOLEM_LEG_GEO} material={LAVA_GOLEM_MAT} />
          <mesh ref={leftArmRef} position={[-SHOULDER_X, SHOULDER_Y, SHOULDER_Z]} geometry={LAVA_GOLEM_LEFT_ARM_GEO} material={LAVA_GOLEM_MAT} />
          <mesh ref={rightArmRef} position={[SHOULDER_X, SHOULDER_Y, SHOULDER_Z]} geometry={LAVA_GOLEM_RIGHT_ARM_GEO} material={LAVA_GOLEM_MAT} />
        </group>
      </group>
    </EnemyBase>
  )
}
