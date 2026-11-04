import { useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  EMBER_WISP_CORE_GEO, EMBER_WISP_TENDRILS_GEO,
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
  const tendrilsRef = useRef<THREE.Mesh>(null)

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

      // Tendrils flicker as one crown
      if (tendrilsRef.current) {
        tendrilsRef.current.rotation.set(
          Math.cos(time * 7 + bobOffset) * 0.2,
          Math.sin(time * 2 + bobOffset) * 0.6,
          Math.sin(time * 8 + bobOffset) * 0.3,
        )
      }
    },
    [driftAngle, driftSpeed, bobOffset],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group scale={[8, 8, 8]}>
        <mesh ref={coreRef} geometry={EMBER_WISP_CORE_GEO} material={EMBER_WISP_CORE_MAT} />
        <mesh ref={tendrilsRef} geometry={EMBER_WISP_TENDRILS_GEO} material={EMBER_WISP_TENDRIL_MAT} />
      </group>
    </EnemyBase>
  )
}
