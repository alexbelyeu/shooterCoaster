import { useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  SCORPION_BODY_GEO, SCORPION_HEAD_GEO, SCORPION_PINCER_GEO,
  SCORPION_TAIL_GEO, SCORPION_STINGER_GEO, SCORPION_LEG_GEO,
  SCORPION_BODY_MAT, SCORPION_HEAD_MAT, SCORPION_PINCER_MAT,
  SCORPION_LEG_MAT, SCORPION_STINGER_MAT,
} from './SharedEnemyAssets'

/**
 * Ground-crawling scorpion enemy.
 * Dark silhouette against desert sand, glowing red stinger.
 */
export default function Scorpion(props: EnemyProps) {
  const moveAngle = useMemo(() => Math.random() * Math.PI * 2, [])
  const moveSpeed = useMemo(() => 0.8 + Math.random() * 1.2, [])
  const tailRef = useRef<THREE.Group>(null)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      const lateralWobble = Math.sin(time * 3) * 0.3
      mesh.position.x += (Math.cos(moveAngle) * moveSpeed + lateralWobble) * dt
      mesh.position.z += (Math.sin(moveAngle) * moveSpeed + lateralWobble * 0.5) * dt

      // Sway tail menacingly
      if (tailRef.current) {
        tailRef.current.rotation.z = Math.sin(time * 2.5) * 0.2
      }
    },
    [moveAngle, moveSpeed],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group scale={[8, 8, 8]} rotation={[0, -moveAngle, 0]}>
        {/* Body - flat wide segment */}
        <mesh geometry={SCORPION_BODY_GEO} material={SCORPION_BODY_MAT} />

        {/* Head */}
        <mesh position={[0, 0.3, 3.5]} geometry={SCORPION_HEAD_GEO} material={SCORPION_HEAD_MAT} />

        {/* Left pincer arm + claw */}
        <group position={[-2, 0.3, 3.5]} rotation={[0, -0.5, 0]}>
          <mesh position={[0, 0, 1.5]} geometry={SCORPION_PINCER_GEO} material={SCORPION_PINCER_MAT} />
          {/* Claw tip - two small angled boxes */}
          <mesh position={[-0.4, 0, 3.2]} geometry={SCORPION_PINCER_GEO} material={SCORPION_PINCER_MAT} scale={[0.5, 1, 0.6]} rotation={[0, -0.3, 0]} />
          <mesh position={[0.4, 0, 3.2]} geometry={SCORPION_PINCER_GEO} material={SCORPION_PINCER_MAT} scale={[0.5, 1, 0.6]} rotation={[0, 0.3, 0]} />
        </group>

        {/* Right pincer arm + claw */}
        <group position={[2, 0.3, 3.5]} rotation={[0, 0.5, 0]}>
          <mesh position={[0, 0, 1.5]} geometry={SCORPION_PINCER_GEO} material={SCORPION_PINCER_MAT} />
          <mesh position={[-0.4, 0, 3.2]} geometry={SCORPION_PINCER_GEO} material={SCORPION_PINCER_MAT} scale={[0.5, 1, 0.6]} rotation={[0, -0.3, 0]} />
          <mesh position={[0.4, 0, 3.2]} geometry={SCORPION_PINCER_GEO} material={SCORPION_PINCER_MAT} scale={[0.5, 1, 0.6]} rotation={[0, 0.3, 0]} />
        </group>

        {/* Tail - chain of spheres curling up and over */}
        <group ref={tailRef} position={[0, 0.5, -2.5]}>
          <mesh position={[0, 0.5, 0]} geometry={SCORPION_TAIL_GEO} material={SCORPION_HEAD_MAT} />
          <mesh position={[0, 1.5, -0.3]} geometry={SCORPION_TAIL_GEO} material={SCORPION_HEAD_MAT} />
          <mesh position={[0, 2.8, -0.2]} geometry={SCORPION_TAIL_GEO} material={SCORPION_HEAD_MAT} />
          <mesh position={[0, 3.8, 0.3]} geometry={SCORPION_TAIL_GEO} material={SCORPION_HEAD_MAT} />
          <mesh position={[0, 4.5, 1.0]} geometry={SCORPION_TAIL_GEO} material={SCORPION_HEAD_MAT} />
          {/* Glowing stinger */}
          <mesh position={[0, 4.8, 1.8]} geometry={SCORPION_STINGER_GEO} material={SCORPION_STINGER_MAT} rotation={[0.5, 0, 0]} />
        </group>

        {/* Legs - 4 pairs, angled outward */}
        {[-1, 1].map((side) => (
          [1.5, 0.5, -0.5, -1.5].map((zOff, i) => (
            <mesh
              key={`leg-${side}-${i}`}
              position={[side * 2.2, -0.5, zOff]}
              geometry={SCORPION_LEG_GEO}
              material={SCORPION_LEG_MAT}
              rotation={[0, 0, side * 0.7]}
            />
          ))
        ))}
      </group>
    </EnemyBase>
  )
}
