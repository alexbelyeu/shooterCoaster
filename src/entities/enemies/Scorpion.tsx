import { useCallback, useContext, useMemo, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import {
  SCORPION_GEO, SCORPION_TAIL_GEO, SCORPION_STINGER_GEO, SCORPION_TAIL_PIVOT,
  SCORPION_SHELL_MAT, SCORPION_TAIL_MAT, SCORPION_STINGER_MAT,
} from './SharedEnemyAssets'

/**
 * Ground-crawling scorpion: dark chitin with amber jointed legs, in three draw
 * calls (merged shell, swaying tail, glowing stinger). Follows terrain height as it moves.
 */
export default function Scorpion(props: EnemyProps) {
  const moveAngle = useMemo(() => Math.random() * Math.PI * 2, [])
  const moveSpeed = useMemo(() => 0.8 + Math.random() * 1.2, [])
  const tailRef = useRef<THREE.Group>(null)
  const heightFn = useContext(TerrainContext)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      const lateralWobble = Math.sin(time * 3) * 0.3
      mesh.position.x += (Math.cos(moveAngle) * moveSpeed + lateralWobble) * dt
      mesh.position.z += (Math.sin(moveAngle) * moveSpeed + lateralWobble * 0.5) * dt

      // Stick to terrain surface
      mesh.position.y = heightFn(mesh.position.x, mesh.position.z) + 5

      if (tailRef.current) {
        tailRef.current.rotation.z = Math.sin(time * 2.5) * 0.2
      }
    },
    [moveAngle, moveSpeed, heightFn],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group scale={[8, 8, 8]} rotation={[0, -moveAngle, 0]}>
        <mesh geometry={SCORPION_GEO} material={SCORPION_SHELL_MAT} />
        <group ref={tailRef} position={SCORPION_TAIL_PIVOT}>
          <mesh geometry={SCORPION_TAIL_GEO} material={SCORPION_TAIL_MAT} />
          <mesh geometry={SCORPION_STINGER_GEO} material={SCORPION_STINGER_MAT} />
        </group>
      </group>
    </EnemyBase>
  )
}
