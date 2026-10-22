import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { GullOrbit } from './seaPlacement'
import { createGullGeometry } from './seaProps'
import { createGullMaterial } from './seaMaterials'

const BANK = 0.35
// Big enough to read as birds (not specks) above stacks 1300+ units away.
const GULL_SCALE = 1.6

/** Gulls circling above the sea stacks: one InstancedMesh, matrices updated each frame. */
export default function Seabirds({ orbits }: { orbits: readonly GullOrbit[] }) {
  const geometry = useMemo(() => createGullGeometry(), [])
  const gull = useMemo(() => createGullMaterial(), [])
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(0, 0, 0, 'YXZ'),
      scale: new THREE.Vector3(GULL_SCALE, GULL_SCALE, GULL_SCALE),
    }),
    [],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      gull.material.dispose()
    }
  }, [geometry, gull])

  useFrame(({ clock }) => {
    const mesh = meshRef.current
    if (!mesh) return
    const t = clock.elapsedTime
    gull.uTime.value = t
    const { matrix, position, quaternion, euler, scale } = tmp
    for (let i = 0; i < orbits.length; i++) {
      const o = orbits[i]
      const a = o.phase + o.speed * t
      const dir = Math.sign(o.speed)
      position.set(o.cx + Math.cos(a) * o.radius, o.y + Math.sin(t * 0.4 + o.phase) * 6, o.cz + Math.sin(a) * o.radius)
      // Nose (+z) along the direction of travel, banked into the turn.
      euler.set(0, Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir), BANK * dir)
      quaternion.setFromEuler(euler)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(i, matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  if (orbits.length === 0) return null
  return <instancedMesh ref={meshRef} args={[geometry, gull.material, orbits.length]} frustumCulled={false} />
}
