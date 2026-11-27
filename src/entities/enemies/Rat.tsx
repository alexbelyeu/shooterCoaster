import { useCallback, useContext, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import { RAT_BODY_GEO, RAT_MAT, RAT_SNOUT_GEO, RAT_SNOUT_PIVOT, RAT_TAIL_GEO, RAT_TAIL_PIVOT } from './SharedEnemyAssets'
import { newRatPose, RAT_CYCLE, ratPose } from './ratMotion.hot'
import type { SlipAway } from './slipAway.hot'
import { useSlipAway } from './useSlipAway'

const RAT_SCALE = 9
/** World units the body lifts at the top of a stride. */
const HOP = 2
const NOSE_TWITCH = 0.14
const TAIL_SWISH = 0.45
/** Level 6's rats dive under the mats 4 s after the rider first sees them (#1059), deeper than the rat stands. */
export const MAT_DIVE: SlipAway = { near: 1300, seenCos: 0.7, linger: 4.5, goS: 0.5, distance: 40 }

/**
 * A cartoon New York rat (#515): scurries over the ground in quick dashes (`ratMotion.hot.ts`), nose twitching, tail swishing,
 * and dives under the mats if not shot in time (`MAT_DIVE`).
 */
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
  const dive = useSlipAway(MAT_DIVE)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, spawnPos: THREE.Vector3, time: number) => {
      startedAt.current ??= time
      ratPose(base, time - startedAt.current + phase, pose)
      mesh.position.x = spawnPos.x + pose.x
      mesh.position.z = spawnPos.z + pose.z
      mesh.position.y = heightFn(mesh.position.x, mesh.position.z) + 1
      const under = dive(mesh.position, time)
      if (under < 0) return 'escaped'
      mesh.position.y -= under
      if (heading.current) heading.current.rotation.y = pose.heading
      if (body.current) body.current.position.y = pose.hop * HOP
      if (snout.current) snout.current.rotation.x = pose.nose * NOSE_TWITCH
      if (tail.current) tail.current.rotation.y = pose.tail * TAIL_SWISH
    },
    [base, phase, heightFn, pose, dive],
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
