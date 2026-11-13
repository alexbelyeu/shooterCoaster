import { useCallback, useContext, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import { DUST_BUNNY_BODY_GEO, DUST_BUNNY_EYE_MAT, DUST_BUNNY_EYES_GEO, DUST_BUNNY_MAT, DUST_BUNNY_RADIUS } from './SharedEnemyAssets'
import { dustBunnyPose, newDustBunnyPose } from './dustBunnyMotion'

const DUST_BUNNY_SCALE = 8
/** Its centre over the floor at rest, world units: the ball, plus a little air. */
const REST_HEIGHT = (DUST_BUNNY_RADIUS + 0.6) * DUST_BUNNY_SCALE

/**
 * A dust bunny (#515): a fluffy ball of dust and chalk rolling and drifting low over the floor (`dustBunnyMotion.ts`).
 * The fluff rolls; the eyes stay on its front.
 */
export default function DustBunny(props: EnemyProps) {
  const { base, phase } = useEnemyRandom(props.id, (rng) => ({ base: rng() * Math.PI * 2, phase: rng() * 2 }))
  const heightFn = useContext(TerrainContext)
  const pose = useRef(newDustBunnyPose()).current
  const startedAt = useRef<number | null>(null)
  const heading = useRef<THREE.Group>(null)
  const ball = useRef<THREE.Group>(null)
  const fluff = useRef<THREE.Mesh>(null)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, spawnPos: THREE.Vector3, time: number) => {
      startedAt.current ??= time
      dustBunnyPose(base, DUST_BUNNY_RADIUS * DUST_BUNNY_SCALE, time - startedAt.current + phase, pose)
      mesh.position.x = spawnPos.x + pose.x
      mesh.position.z = spawnPos.z + pose.z
      mesh.position.y = heightFn(mesh.position.x, mesh.position.z) + REST_HEIGHT
      if (heading.current) heading.current.rotation.y = pose.heading
      if (ball.current) {
        ball.current.position.y = pose.lift * DUST_BUNNY_SCALE
        ball.current.scale.set(1 + pose.squash / 2, 1 - pose.squash, 1 + pose.squash / 2).multiplyScalar(DUST_BUNNY_SCALE)
      }
      if (fluff.current) fluff.current.rotation.x = pose.roll
    },
    [base, phase, heightFn, pose],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={heading} rotation={[0, base, 0]}>
        <group ref={ball} scale={DUST_BUNNY_SCALE}>
          <mesh ref={fluff} geometry={DUST_BUNNY_BODY_GEO} material={DUST_BUNNY_MAT} />
          <mesh geometry={DUST_BUNNY_EYES_GEO} material={DUST_BUNNY_EYE_MAT} />
        </group>
      </group>
    </EnemyBase>
  )
}
