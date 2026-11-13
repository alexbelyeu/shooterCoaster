import { useCallback, useContext, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import { RAT_BODY_GEO, RAT_MAT, RAT_SNOUT_GEO, RAT_SNOUT_PIVOT, RAT_TAIL_GEO, RAT_TAIL_PIVOT } from './SharedEnemyAssets'
import { newRatPose, RAT_CYCLE, ratPose } from './ratMotion'

const RAT_SCALE = 9
/** World units the body lifts at the top of a stride. */
const HOP = 2
const NOSE_TWITCH = 0.14
const TAIL_SWISH = 0.45

/** A cartoon New York rat (#515): scurries over the ground in quick dashes (`ratMotion.ts`), nose twitching, tail swishing. */
export default function Rat(props: EnemyProps) {
  // A random start in the dash cycle, so a wave's rats don't dart in step.
  const { base, phase } = useEnemyRandom(props.id, (rng) => ({ base: rng() * Math.PI * 2, phase: rng() * RAT_CYCLE }))
  const heightFn = useContext(TerrainContext)
  const pose = useRef(newRatPose()).current
  const startedAt = useRef<number | null>(null)
  const heading = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const snout = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, spawnPos: THREE.Vector3, time: number) => {
      startedAt.current ??= time
      ratPose(base, time - startedAt.current + phase, pose)
      mesh.position.x = spawnPos.x + pose.x
      mesh.position.z = spawnPos.z + pose.z
      mesh.position.y = heightFn(mesh.position.x, mesh.position.z) + 1
      if (heading.current) heading.current.rotation.y = pose.heading
      if (body.current) body.current.position.y = pose.hop * HOP
      if (snout.current) snout.current.rotation.x = pose.nose * NOSE_TWITCH
      if (tail.current) tail.current.rotation.y = pose.tail * TAIL_SWISH
    },
    [base, phase, heightFn, pose],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={heading} rotation={[0, base, 0]}>
        <group ref={body} scale={RAT_SCALE}>
          <mesh geometry={RAT_BODY_GEO} material={RAT_MAT} />
          <group ref={snout} position={RAT_SNOUT_PIVOT}>
            <mesh geometry={RAT_SNOUT_GEO} material={RAT_MAT} />
          </group>
          <group ref={tail} position={RAT_TAIL_PIVOT}>
            <mesh geometry={RAT_TAIL_GEO} material={RAT_MAT} />
          </group>
        </group>
      </group>
    </EnemyBase>
  )
}
