import { useCallback, useRef } from 'react'
import type * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { SEA_DIVE } from './seaDive.hot'
import { JELLY_COLOR_COUNT, JELLY_GEO, JELLY_MATS } from './SharedEnemyAssets'
import { useSeaDive } from './useSeaDive'

/**
 * Translucent jellyfish on the water beside the track: rises until its bell is clear of the surface, bobs there, and sinks
 * away if the rider leaves it too long (`useSeaDive`).
 */
export default function Jellyfish(props: EnemyProps) {
  const { colorIdx, wobbleOffset, riseSpeed, maxY } = useEnemyRandom(props.id, (rng) => ({
    colorIdx: Math.floor(rng() * JELLY_COLOR_COUNT),
    wobbleOffset: rng() * Math.PI * 2,
    riseSpeed: 0.3 + rng() * 0.3,
    maxY: 3 + rng() * 5,
  }))
  const bodyRef = useRef<THREE.Group>(null)
  const dive = useSeaDive('jellyfish', props.onEscape !== undefined)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      const sunk = dive(mesh, time)
      if (sunk >= 1) return 'escaped' as const

      if (sunk > 0) {
        mesh.position.y = maxY + Math.sin(time * 1.5 + wobbleOffset) * 2 - sunk * SEA_DIVE.depth
      } else if (mesh.position.y < maxY) {
        mesh.position.y += riseSpeed * dt
      } else {
        mesh.position.y = maxY + Math.sin(time * 1.5 + wobbleOffset) * 2
      }

      mesh.position.x += Math.sin(time * 2 + wobbleOffset) * 0.15 * dt
      mesh.position.z += Math.cos(time * 1.5 + wobbleOffset) * 0.1 * dt

      // The bell rocks, so the tentacles below it sway.
      const body = bodyRef.current
      if (body) {
        body.rotation.x = Math.sin(time * 1.5 + wobbleOffset) * 0.12
        body.rotation.z = Math.cos(time * 1.2 + wobbleOffset) * 0.08
      }
    },
    [riseSpeed, wobbleOffset, maxY, dive],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={bodyRef} scale={[7, 7, 7]}>
        <mesh geometry={JELLY_GEO} material={JELLY_MATS[colorIdx]} />
      </group>
    </EnemyBase>
  )
}
