import { useCallback, useRef, useState } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  BALLOON_BODY_GEO, BALLOON_KNOT_GEO, BALLOON_STRING_GEO,
  GOLDEN_BODY_MAT, GOLDEN_KNOT_MAT, GOLDEN_STRING_MAT,
} from './SharedEnemyAssets'

/**
 * Golden bonus balloon: 5x points, emissive gold, bobs up and down,
 * auto-despawns after 5 seconds.
 */
export default function GoldenBalloon(props: EnemyProps) {
  const [visible, setVisible] = useState(true)
  const spawnTime = useRef(performance.now())

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      mesh.position.y += 0.3 * dt

      // Bob up and down
      mesh.position.y += Math.sin(time * 3) * 0.5

      // Auto-despawn after 5 seconds
      if (performance.now() - spawnTime.current > 5000) {
        setVisible(false)
      }
    },
    [],
  )

  if (!visible) return null

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group>
        {/* Golden balloon body */}
        <mesh scale={[1, 1.3, 1]} geometry={BALLOON_BODY_GEO} material={GOLDEN_BODY_MAT} />

        {/* Knot */}
        <mesh position={[0, -35, 0]} geometry={BALLOON_KNOT_GEO} material={GOLDEN_KNOT_MAT} />

        {/* String */}
        <mesh position={[0, -65, 0]} geometry={BALLOON_STRING_GEO} material={GOLDEN_STRING_MAT} />
      </group>
    </EnemyBase>
  )
}
