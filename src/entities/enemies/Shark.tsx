import { useCallback, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  SHARK_BODY_GEO, SHARK_SNOUT_GEO, SHARK_DORSAL_GEO,
  SHARK_TAIL_UPPER_GEO, SHARK_TAIL_LOWER_GEO,
  SHARK_PECTORAL_GEO, SHARK_EYE_GEO, SHARK_MOUTH_GEO,
  SHARK_TOOTH_GEO, SHARK_GILL_GEO,
  SHARK_BODY_MAT, SHARK_SNOUT_MAT, SHARK_FIN_MAT,
  SHARK_BELLY_MAT, SHARK_EYE_MAT, SHARK_MOUTH_MAT, SHARK_TOOTH_MAT,
} from './SharedEnemyAssets'

/** Lathe torpedo body, swept-back fins, crescent tail, teeth and gills; always faces the camera. */
export default function Shark(props: EnemyProps) {
  // A circle through the spawn point, small enough to stay beside the track it was placed by (#316).
  const orbit = useMemo(() => ({
    radius: 25 + Math.random() * 35,
    rate: (0.4 + Math.random() * 0.4) * (Math.random() < 0.5 ? -1 : 1),
    phase: Math.random() * Math.PI * 2,
  }), [])
  const startTime = useRef<number | null>(null)
  const tailRef = useRef<THREE.Group>(null)
  const modelRef = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, spawnPos: THREE.Vector3, time: number) => {
      startTime.current ??= time
      const { radius, rate, phase } = orbit
      const a = phase + rate * (time - startTime.current)
      mesh.position.x = spawnPos.x + radius * (Math.cos(a) - Math.cos(phase))
      mesh.position.z = spawnPos.z + radius * (Math.sin(a) - Math.sin(phase))
      mesh.position.y = 2

      if (tailRef.current) {
        tailRef.current.rotation.y = Math.sin(time * 4) * 0.3
      }
    },
    [orbit],
  )

  useFrame(() => {
    if (!modelRef.current?.parent) return
    const parent = modelRef.current.parent
    const dx = camera.position.x - parent.position.x
    const dz = camera.position.z - parent.position.z
    modelRef.current.rotation.y = Math.atan2(dx, dz)
  })

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={modelRef} scale={[10, 10, 10]}>
        {/* Body — lathe torpedo, rotated so length runs along Z */}
        <mesh
          geometry={SHARK_BODY_GEO}
          material={SHARK_BODY_MAT}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, -2]}
        />

        {/* Belly — lighter underside, slightly smaller */}
        <mesh
          geometry={SHARK_BODY_GEO}
          material={SHARK_BELLY_MAT}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, -1, -2]}
          scale={[0.85, 0.85, 0.55]}
        />

        <mesh
          position={[0, -0.3, 5.5]}
          geometry={SHARK_SNOUT_GEO}
          material={SHARK_SNOUT_MAT}
          rotation={[-Math.PI / 2, 0, 0]}
        />

        {/* Dorsal fin — tall swept triangle */}
        <mesh
          position={[0, 2.8, 0]}
          geometry={SHARK_DORSAL_GEO}
          material={SHARK_FIN_MAT}
        />

        {/* Tail group — crescent shape with sway */}
        <group ref={tailRef} position={[0, 0, -5]}>
          <mesh geometry={SHARK_TAIL_UPPER_GEO} material={SHARK_FIN_MAT} scale={[1, 1.2, 1.2]} />
          <mesh geometry={SHARK_TAIL_LOWER_GEO} material={SHARK_FIN_MAT} scale={[1, 1, 1]} />
        </group>

        <mesh
          position={[-2.5, -0.8, 2]}
          geometry={SHARK_PECTORAL_GEO}
          material={SHARK_FIN_MAT}
          rotation={[0.1, 0.2, -0.3]}
          scale={[-1, 1, 1]}
        />
        <mesh
          position={[2.5, -0.8, 2]}
          geometry={SHARK_PECTORAL_GEO}
          material={SHARK_FIN_MAT}
          rotation={[0.1, -0.2, 0.3]}
        />

        {/* Eyes — larger, menacing */}
        <mesh position={[-1.8, 0.8, 4.5]} geometry={SHARK_EYE_GEO} material={SHARK_EYE_MAT} />
        <mesh position={[1.8, 0.8, 4.5]} geometry={SHARK_EYE_GEO} material={SHARK_EYE_MAT} />

        <mesh position={[0, -1.2, 5]} geometry={SHARK_MOUTH_GEO} material={SHARK_MOUTH_MAT} />

        {/* Teeth — row of small cones along the mouth */}
        {[-0.8, -0.4, 0, 0.4, 0.8].map((xOff, i) => (
          <mesh
            key={`tooth-${i}`}
            position={[xOff, -1.05, 5.2]}
            geometry={SHARK_TOOTH_GEO}
            material={SHARK_TOOTH_MAT}
            rotation={[Math.PI, 0, 0]}
          />
        ))}

        {/* Gill slits — 3 per side */}
        {[-1, 1].map((side) =>
          [0, 0.6, 1.2].map((zOff, i) => (
            <mesh
              key={`gill-${side}-${i}`}
              position={[side * 2.4, 0, 3 - zOff]}
              geometry={SHARK_GILL_GEO}
              material={SHARK_MOUTH_MAT}
            />
          ))
        )}
      </group>
    </EnemyBase>
  )
}
