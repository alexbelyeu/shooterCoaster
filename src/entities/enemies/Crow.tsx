import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { CROW_GEO, CROW_EYES_GEO, CROW_EYE_MAT, createCrowFeatherMaterial } from './SharedEnemyAssets'

/**
 * Iridescent crow with a 2-joint articulated wing flap, in two draw calls: the
 * merged feathers (body, tail fan, beak, wings) and the eyes. The wings flap in
 * the feather material's vertex shader from this crow's `flap` angles.
 */
export default function Crow(props: EnemyProps) {
  // One speed for the whole flock, or its V stretches apart.
  const moveAngle = useMemo(() => props.heading ?? Math.random() * Math.PI * 2, [props.heading])
  const moveSpeed = useMemo(() => (props.heading === undefined ? 0.4 + Math.random() * 0.6 : 0.7), [props.heading])
  const flapOffset = useMemo(() => Math.random() * Math.PI * 2, [])
  const flap = useMemo(() => ({ value: new THREE.Vector2() }), [])
  const featherMat = useMemo(() => createCrowFeatherMaterial(flap), [flap])
  useEffect(() => () => featherMat.dispose(), [featherMat])
  const bodyGroupRef = useRef<THREE.Group>(null)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60
      const wobble = Math.sin(time * 1.5) * 0.3
      mesh.position.x += (Math.cos(moveAngle) * moveSpeed + wobble) * dt
      mesh.position.z += (Math.sin(moveAngle) * moveSpeed + wobble * 0.5) * dt
      mesh.position.y += Math.sin(time * 2 + flapOffset) * 0.05 * dt

      // Inner wing leads, outer trails with a phase delay
      const t = time * 5 + flapOffset
      flap.value.set(Math.sin(t) * 0.5, Math.sin(t + 0.5) * 0.4)

      // Subtle body roll
      if (bodyGroupRef.current) {
        bodyGroupRef.current.rotation.z = Math.sin(t) * 0.08
      }
    },
    [moveAngle, moveSpeed, flapOffset, flap],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={bodyGroupRef} scale={[8, 8, 8]} rotation={[0, -moveAngle + Math.PI / 2, 0]}>
        <mesh geometry={CROW_GEO} material={featherMat} />
        <mesh geometry={CROW_EYES_GEO} material={CROW_EYE_MAT} />
      </group>
    </EnemyBase>
  )
}
