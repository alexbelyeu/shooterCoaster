import { useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  EMBER_WISP_CORE_GEO, EMBER_WISP_TENDRIL_GEO,
  EMBER_WISP_CORE_MAT, EMBER_WISP_TENDRIL_MAT,
} from './SharedEnemyAssets'

/**
 * Small flying fire elemental. Erratic bobbing flight, pulsing core,
 * flickering flame tendrils. Appears in large swarms.
 */
export default function EmberWisp(props: EnemyProps) {
  const driftAngle = useMemo(() => Math.random() * Math.PI * 2, [])
  const driftSpeed = useMemo(() => 0.3 + Math.random() * 0.5, [])
  const bobOffset = useMemo(() => Math.random() * Math.PI * 2, [])
  const coreRef = useRef<THREE.Mesh>(null)
  const tendrilRefs = useRef<(THREE.Mesh | null)[]>([])

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      const wobble = Math.sin(time * 3 + bobOffset) * 0.2
      mesh.position.x += (Math.cos(driftAngle + time * 0.5) * driftSpeed + wobble) * dt
      mesh.position.z += (Math.sin(driftAngle + time * 0.5) * driftSpeed) * dt
      mesh.position.y += Math.sin(time * 2.5 + bobOffset) * 0.08 * dt

      // Core pulse
      if (coreRef.current) {
        const s = 0.8 + Math.sin(time * 6 + bobOffset) * 0.2
        coreRef.current.scale.setScalar(s)
      }

      // Tendril flicker
      for (let i = 0; i < tendrilRefs.current.length; i++) {
        const t = tendrilRefs.current[i]
        if (t) {
          t.rotation.z = Math.sin(time * 8 + i * 1.5) * 0.3
          t.rotation.x = Math.cos(time * 7 + i * 2) * 0.2
        }
      }
    },
    [driftAngle, driftSpeed, bobOffset],
  )

  // 6 tendril positions radiating from center
  const tendrilAngles = useMemo(() => {
    const arr: number[] = []
    for (let i = 0; i < 6; i++) arr.push((i / 6) * Math.PI * 2)
    return arr
  }, [])

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group scale={[8, 8, 8]}>
        {/* Glowing core */}
        <mesh ref={coreRef} geometry={EMBER_WISP_CORE_GEO} material={EMBER_WISP_CORE_MAT} />

        {/* Flame tendrils */}
        {tendrilAngles.map((angle, i) => (
          <mesh
            key={`tendril-${i}`}
            ref={(el) => { tendrilRefs.current[i] = el }}
            geometry={EMBER_WISP_TENDRIL_GEO}
            material={EMBER_WISP_TENDRIL_MAT}
            position={[Math.cos(angle) * 3.5, Math.sin(angle) * 1, Math.sin(angle) * 3.5]}
            rotation={[0, angle, Math.PI / 3]}
          />
        ))}
      </group>
    </EnemyBase>
  )
}
