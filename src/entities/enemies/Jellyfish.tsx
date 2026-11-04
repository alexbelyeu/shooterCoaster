import { useCallback, useMemo, useRef } from 'react'
import type * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { JELLY_BODY_GEO, JELLY_BODY_MATS, JELLY_COLOR_COUNT, JELLY_INNER_GEO, JELLY_INNER_MATS } from './SharedEnemyAssets'

/** Translucent jellyfish on the water beside the track: rises until its bell is clear of the surface, then bobs there. */
export default function Jellyfish(props: EnemyProps) {
  const colorIdx = useMemo(() => Math.floor(Math.random() * JELLY_COLOR_COUNT), [])
  const wobbleOffset = useMemo(() => Math.random() * Math.PI * 2, [])
  const riseSpeed = useMemo(() => 0.3 + Math.random() * 0.3, [])
  const bodyRef = useRef<THREE.Group>(null)

  const maxY = useMemo(() => 3 + Math.random() * 5, [])

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60

      if (mesh.position.y < maxY) {
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
    [riseSpeed, wobbleOffset, maxY],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={bodyRef} scale={[7, 7, 7]}>
        <mesh geometry={JELLY_BODY_GEO} material={JELLY_BODY_MATS[colorIdx]} />
        <mesh position={[0, 1, 0]} geometry={JELLY_INNER_GEO} material={JELLY_INNER_MATS[colorIdx]} />
      </group>
    </EnemyBase>
  )
}
