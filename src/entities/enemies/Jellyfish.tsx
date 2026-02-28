import { useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  JELLY_DOME_GEO, JELLY_INNER_GEO, JELLY_TENTACLE_GEO,
  JELLY_DOME_MATS, JELLY_INNER_MATS, JELLY_TENTACLE_MATS,
  JELLY_COLOR_COUNT,
} from './SharedEnemyAssets'

/**
 * Translucent jellyfish that rises slowly from below water.
 * Dome with hanging tentacles, gentle lateral wobble, inner glow.
 */
export default function Jellyfish(props: EnemyProps) {
  const colorIdx = useMemo(() => Math.floor(Math.random() * JELLY_COLOR_COUNT), [])
  const wobbleOffset = useMemo(() => Math.random() * Math.PI * 2, [])
  const riseSpeed = useMemo(() => 0.3 + Math.random() * 0.3, [])
  const tentacleRefs = useRef<(THREE.Mesh | null)[]>([])

  const maxY = useMemo(() => 3 + Math.random() * 5, []) // bob just above/at water surface

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60

      if (mesh.position.y < maxY) {
        // Rise toward water surface
        mesh.position.y += riseSpeed * dt
      } else {
        // Bob gently at surface
        mesh.position.y = maxY + Math.sin(time * 1.5 + wobbleOffset) * 2
      }

      // Gentle lateral wobble
      mesh.position.x += Math.sin(time * 2 + wobbleOffset) * 0.15 * dt
      mesh.position.z += Math.cos(time * 1.5 + wobbleOffset) * 0.1 * dt

      // Tentacle sway
      for (let i = 0; i < tentacleRefs.current.length; i++) {
        const t = tentacleRefs.current[i]
        if (t) {
          t.rotation.x = Math.sin(time * 1.5 + i * 0.8) * 0.15
          t.rotation.z = Math.cos(time * 1.2 + i * 1.1) * 0.1
        }
      }
    },
    [riseSpeed, wobbleOffset, maxY],
  )

  const tentacleAngles = useMemo(() => {
    const angles: number[] = []
    const count = 5
    for (let i = 0; i < count; i++) {
      angles.push((i / count) * Math.PI * 2)
    }
    return angles
  }, [])

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group scale={[7, 7, 7]}>
        {/* Dome */}
        <mesh geometry={JELLY_DOME_GEO} material={JELLY_DOME_MATS[colorIdx]} />

        {/* Inner glow */}
        <mesh position={[0, 1, 0]} geometry={JELLY_INNER_GEO} material={JELLY_INNER_MATS[colorIdx]} />

        {/* Tentacles hanging below */}
        {tentacleAngles.map((angle, i) => {
          const r = 1.8
          return (
            <mesh
              key={i}
              ref={(el) => { tentacleRefs.current[i] = el }}
              position={[Math.cos(angle) * r, -3, Math.sin(angle) * r]}
              geometry={JELLY_TENTACLE_GEO}
              material={JELLY_TENTACLE_MATS[colorIdx]}
            />
          )
        })}
      </group>
    </EnemyBase>
  )
}
