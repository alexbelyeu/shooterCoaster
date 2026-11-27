import { useCallback, useContext, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import { DUST_BUNNY_GEO, DUST_BUNNY_MAT, DUST_BUNNY_RADIUS, DUST_BUNNY_REACH, dustBunnyRoll } from './SharedEnemyAssets'
import { DUST_BUNNY, dustBunnyCirclePose, dustBunnyDrop, dustBunnyPose, newDustBunnyPose } from './dustBunnyMotion.hot'

const DUST_BUNNY_SCALE = 8
/**
 * Its centre over the floor at rest, world units: its lowest reach over a bounce, the rolling stray hairs included,
 * plus a little air (#524).
 */
const REST_HEIGHT = (dustBunnyDrop(DUST_BUNNY_REACH) + 0.1) * DUST_BUNNY_SCALE
/** How far out its fluff spreads over the floor at the widest of the squash, world units. */
const FOOTPRINT = DUST_BUNNY_REACH * (1 + DUST_BUNNY.squash / 2) * DUST_BUNNY_SCALE

/**
 * A dust bunny (#515): a fluffy ball of dust and chalk rolling and drifting low over the floor (`dustBunnyMotion.hot.ts`).
 * The fluff rolls; the eyes stay on its front (one mesh, `DUST_BUNNY_GEO`'s morph targets). Given a `floor` (a perch's height,
 * `spawning/perch.ts`), it drifts round a small circle at that height instead.
 */
export default function DustBunny(props: EnemyProps) {
  const { floor } = props
  const { base, phase } = useEnemyRandom(props.id, (rng) => ({ base: rng() * Math.PI * 2, phase: rng() * 2 }))
  const heightFn = useContext(TerrainContext)
  const pose = useRef(newDustBunnyPose()).current
  const startedAt = useRef<number | null>(null)
  const heading = useRef<THREE.Group>(null)
  const ball = useRef<THREE.Group>(null)
  const fluff = useRef<THREE.Mesh>(null)
  // r3f sets the geometry after construction: the mesh only picks up its morph targets here.
  useLayoutEffect(() => fluff.current?.updateMorphTargets(), [])

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, spawnPos: THREE.Vector3, time: number) => {
      startedAt.current ??= time
      const t = time - startedAt.current + phase
      if (floor) dustBunnyCirclePose(base, DUST_BUNNY_RADIUS * DUST_BUNNY_SCALE, t, pose)
      else dustBunnyPose(base, DUST_BUNNY_RADIUS * DUST_BUNNY_SCALE, t, pose)
      mesh.position.x = spawnPos.x + pose.x
      mesh.position.z = spawnPos.z + pose.z
      // The highest floor under its footprint, not just under its centre: on a slope or at the pit's edge.
      const { x, z } = mesh.position
      const ground = floor ? floor.y : Math.max(
        heightFn(x, z), heightFn(x + FOOTPRINT, z), heightFn(x - FOOTPRINT, z), heightFn(x, z + FOOTPRINT), heightFn(x, z - FOOTPRINT),
      )
      mesh.position.y = ground + REST_HEIGHT
      if (heading.current) heading.current.rotation.y = pose.heading
      if (ball.current) {
        ball.current.position.y = pose.lift * DUST_BUNNY_SCALE
        ball.current.scale.set(1 + pose.squash / 2, 1 - pose.squash, 1 + pose.squash / 2).multiplyScalar(DUST_BUNNY_SCALE)
      }
      if (fluff.current?.morphTargetInfluences) dustBunnyRoll(fluff.current.morphTargetInfluences, pose.roll)
    },
    [base, phase, heightFn, pose, floor],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={heading} rotation={[0, base, 0]}>
        <group ref={ball} scale={DUST_BUNNY_SCALE}>
          <mesh ref={fluff} geometry={DUST_BUNNY_GEO} material={DUST_BUNNY_MAT} />
        </group>
      </group>
    </EnemyBase>
  )
}
