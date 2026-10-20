import { useMemo, useRef, useCallback } from 'react'
import * as THREE from 'three'
import FerrisWheel from '../../FerrisWheel'
import Carousel from '../../Carousel'

/** String lights — catenary curves of emissive spheres between poles */
function StringLights() {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const lights = useMemo(() => {
    const arr: { x: number; y: number; z: number }[] = []

    for (let s = 0; s < 10; s++) {
      const theta1 = (s / 10) * Math.PI * 2
      const theta2 = ((s + 1) / 10) * Math.PI * 2
      const r = 420

      const x1 = Math.cos(theta1) * r
      const z1 = Math.sin(theta1) * r
      const x2 = Math.cos(theta2) * r
      const z2 = Math.sin(theta2) * r

      const bulbCount = 10
      for (let i = 0; i <= bulbCount; i++) {
        const t = i / bulbCount
        const x = x1 + (x2 - x1) * t
        const z = z1 + (z2 - z1) * t
        const sag = Math.sin(t * Math.PI) * 8
        const y = 48 - sag

        arr.push({ x, y, z })
      }
    }

    return arr
  }, [])

  const setRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    ;(meshRef as any).current = mesh
    const mat = new THREE.Matrix4()
    for (let i = 0; i < lights.length; i++) {
      mat.makeTranslation(lights[i].x, lights[i].y, lights[i].z)
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [lights])

  return (
    <instancedMesh ref={setRef} args={[undefined, undefined, lights.length]} frustumCulled={false}>
      <sphereGeometry args={[1.2, 6, 6]} />
      <meshStandardMaterial
        color="#ffffff"
        emissive="#ffcc44"
        emissiveIntensity={3}
        toneMapped={false}
      />
    </instancedMesh>
  )
}

/** Rides and string lights for the theme park */
export default function ThemeParkFeatures() {
  return (
    <>
      <FerrisWheel position={[500, 0, -300]} radius={80} />
      <Carousel position={[-400, 0, -200]} radius={25} />
      <Carousel position={[200, 0, 400]} radius={20} />
      <StringLights />
    </>
  )
}
