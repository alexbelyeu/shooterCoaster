import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface VolcanoProps {
  position: [number, number, number]
  lavaMaterial?: THREE.ShaderMaterial | null
}

// Shared geometries — large scale to be visible as distant landmark
const MOUNTAIN_GEO = new THREE.ConeGeometry(1200, 1600, 12)
const CRATER_GEO = new THREE.TorusGeometry(160, 60, 8, 12)
const CORE_GEO = new THREE.SphereGeometry(120, 8, 8)
const LAVA_FLOW_GEO = new THREE.PlaneGeometry(40, 800, 4, 40)
const PLUME_GEO = new THREE.SphereGeometry(400, 8, 6)

// Materials
const MOUNTAIN_MAT = new THREE.MeshPhongMaterial({
  color: '#2a1510',
  specular: '#443322',
  shininess: 15,
  flatShading: true,
})
const CRATER_MAT = new THREE.MeshPhongMaterial({
  color: '#3a2018',
  flatShading: true,
})
const CORE_MAT = new THREE.MeshPhongMaterial({
  color: '#ff4400',
  emissive: '#ff2200',
  emissiveIntensity: 0.8,
})
const LAVA_FLOW_FALLBACK_MAT = new THREE.MeshPhongMaterial({
  color: '#ff3300',
  emissive: '#ff1100',
  emissiveIntensity: 0.5,
  transparent: true,
  opacity: 0.7,
  side: THREE.DoubleSide,
})
const PLUME_MAT = new THREE.MeshPhongMaterial({
  color: '#3a3030',
  transparent: true,
  opacity: 0.3,
})

/**
 * Multi-part erupting volcano landmark.
 * Large cone mountain, glowing crater core, lava flow strips, and ash plume.
 */
export default function Volcano({ position, lavaMaterial }: VolcanoProps) {
  const coreRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (coreRef.current) {
      const t = clock.elapsedTime
      const mat = coreRef.current.material as THREE.MeshPhongMaterial
      mat.emissiveIntensity = 0.6 + Math.sin(t * 2) * 0.3
    }
  })

  // Lava flow strip angles — radiating down the cone sides
  const flowAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5]
  const flowMat = lavaMaterial ?? LAVA_FLOW_FALLBACK_MAT

  return (
    <group position={position}>
      {/* Mountain cone */}
      <mesh
        geometry={MOUNTAIN_GEO}
        material={MOUNTAIN_MAT}
        position={[0, 800, 0]}
      />

      {/* Crater rim */}
      <mesh
        geometry={CRATER_GEO}
        material={CRATER_MAT}
        position={[0, 1600, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />

      {/* Glowing lava core inside crater */}
      <mesh
        ref={coreRef}
        geometry={CORE_GEO}
        material={CORE_MAT}
        position={[0, 1540, 0]}
      />

      {/* Lava flow strips down the sides */}
      {flowAngles.map((angle, i) => {
        const x = Math.cos(angle) * 300
        const z = Math.sin(angle) * 300
        return (
          <mesh
            key={`flow-${i}`}
            geometry={LAVA_FLOW_GEO}
            material={flowMat}
            position={[x, 800, z]}
            rotation={[-0.8, angle, 0]}
          />
        )
      })}

      {/* Ash plume above crater */}
      <mesh
        geometry={PLUME_GEO}
        material={PLUME_MAT}
        position={[0, 1900, 0]}
      />
    </group>
  )
}
