import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface IceFortressProps {
  position: [number, number, number]
}

// Shared geometries
const TOWER_GEO = new THREE.CylinderGeometry(15, 18, 1, 6)
const SIDE_TOWER_GEO = new THREE.CylinderGeometry(8, 10, 1, 6)
const WALL_GEO = new THREE.BoxGeometry(1, 40, 4)
const BATTLEMENT_GEO = new THREE.BoxGeometry(5, 8, 5)
const GATE_GEO = new THREE.TorusGeometry(20, 4, 6, 12, Math.PI)
const SPIKE_GEO = new THREE.ConeGeometry(3, 18, 4)
const CRYSTAL_GEO = new THREE.OctahedronGeometry(10, 0)
const CONE_CAP_GEO = new THREE.ConeGeometry(18, 30, 6)
const SIDE_CONE_CAP_GEO = new THREE.ConeGeometry(12, 20, 6)

// Materials — translucent icy look
const ICE_MAT = new THREE.MeshPhongMaterial({
  color: '#a0d0f0',
  flatShading: true,
  transparent: true,
  opacity: 0.7,
  side: THREE.DoubleSide,
})
const ICE_WALL_MAT = new THREE.MeshPhongMaterial({
  color: '#c0e8ff',
  flatShading: true,
  transparent: true,
  opacity: 0.6,
  side: THREE.DoubleSide,
})
const BATTLEMENT_MAT = new THREE.MeshPhongMaterial({
  color: '#b0d8f0',
  flatShading: true,
  transparent: true,
  opacity: 0.75,
})
const GATE_MAT = new THREE.MeshPhongMaterial({
  color: '#80c0e0',
  flatShading: true,
  transparent: true,
  opacity: 0.65,
})
const SPIKE_MAT = new THREE.MeshPhongMaterial({
  color: '#d0f0ff',
  flatShading: true,
  transparent: true,
  opacity: 0.8,
})
const CRYSTAL_MAT = new THREE.MeshStandardMaterial({
  color: '#80d0ff',
  emissive: '#40a0dd',
  emissiveIntensity: 3,
  toneMapped: false,
  transparent: true,
  opacity: 0.9,
})
const CAP_MAT = new THREE.MeshPhongMaterial({
  color: '#90c8e8',
  flatShading: true,
  transparent: true,
  opacity: 0.75,
})

/**
 * Towering crystalline ice fortress — hexagonal central tower,
 * 4 side towers, connecting walls, battlements, gate arch, ice spikes,
 * and a floating crystal above the central tower.
 */
export default function IceFortress({ position }: IceFortressProps) {
  const crystalRef = useRef<THREE.Mesh>(null)

  // 4 side tower positions
  const sideTowers = useMemo(() => {
    const arr: { x: number; z: number }[] = []
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4
      const r = 55
      arr.push({ x: Math.cos(angle) * r, z: Math.sin(angle) * r })
    }
    return arr
  }, [])

  // Battlements along wall tops
  const battlements = useMemo(() => {
    const arr: { x: number; y: number; z: number }[] = []
    for (let i = 0; i < 4; i++) {
      const t1 = sideTowers[i]
      const t2 = sideTowers[(i + 1) % 4]
      const count = 6
      for (let j = 1; j < count; j++) {
        const t = j / count
        arr.push({
          x: t1.x + (t2.x - t1.x) * t,
          y: 44,
          z: t1.z + (t2.z - t1.z) * t,
        })
      }
    }
    return arr
  }, [sideTowers])

  // Ice spikes scattered on towers
  const spikes = useMemo(() => {
    const arr: { x: number; y: number; z: number; rx: number; rz: number }[] = []
    // Central tower spikes
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2
      arr.push({
        x: Math.cos(angle) * 14,
        y: 110 + Math.random() * 15,
        z: Math.sin(angle) * 14,
        rx: Math.cos(angle) * 0.3,
        rz: Math.sin(angle) * 0.3,
      })
    }
    // Side tower spikes
    for (const t of sideTowers) {
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2
        arr.push({
          x: t.x + Math.cos(angle) * 8,
          y: 75 + Math.random() * 10,
          z: t.z + Math.sin(angle) * 8,
          rx: Math.cos(angle) * 0.25,
          rz: Math.sin(angle) * 0.25,
        })
      }
    }
    return arr
  }, [sideTowers])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (crystalRef.current) {
      crystalRef.current.rotation.y = t * 0.6
      crystalRef.current.position.y = 140 + Math.sin(t * 0.7) * 5
    }
  })

  return (
    <group position={position}>
      {/* Central tower */}
      <mesh
        geometry={TOWER_GEO}
        material={ICE_MAT}
        position={[0, 60, 0]}
        scale={[1, 120, 1]}
      />
      {/* Central tower conical cap */}
      <mesh geometry={CONE_CAP_GEO} material={CAP_MAT} position={[0, 125, 0]} />

      {/* Side towers */}
      {sideTowers.map((t, i) => (
        <group key={`side-${i}`}>
          <mesh
            geometry={SIDE_TOWER_GEO}
            material={ICE_MAT}
            position={[t.x, 40, t.z]}
            scale={[1, 80, 1]}
          />
          <mesh geometry={SIDE_CONE_CAP_GEO} material={CAP_MAT} position={[t.x, 85, t.z]} />
        </group>
      ))}

      {/* Walls connecting towers */}
      {sideTowers.map((t, i) => {
        const t2 = sideTowers[(i + 1) % 4]
        const cx = (t.x + t2.x) / 2
        const cz = (t.z + t2.z) / 2
        const dx = t2.x - t.x
        const dz = t2.z - t.z
        const length = Math.sqrt(dx * dx + dz * dz)
        const angle = Math.atan2(dx, dz)
        return (
          <mesh
            key={`wall-${i}`}
            geometry={WALL_GEO}
            material={ICE_WALL_MAT}
            position={[cx, 20, cz]}
            rotation={[0, angle, 0]}
            scale={[length, 1, 1]}
          />
        )
      })}

      {/* Battlements */}
      {battlements.map((b, i) => (
        <mesh
          key={`bat-${i}`}
          geometry={BATTLEMENT_GEO}
          material={BATTLEMENT_MAT}
          position={[b.x, b.y, b.z]}
        />
      ))}

      {/* Gate arch at front */}
      <mesh
        geometry={GATE_GEO}
        material={GATE_MAT}
        position={[0, 15, sideTowers[0].z > 0 ? 55 : -55]}
        rotation={[0, 0, 0]}
      />

      {/* Ice spikes */}
      {spikes.map((s, i) => (
        <mesh
          key={`spike-${i}`}
          geometry={SPIKE_GEO}
          material={SPIKE_MAT}
          position={[s.x, s.y, s.z]}
          rotation={[s.rx, 0, s.rz]}
        />
      ))}

      {/* Floating crystal above central tower */}
      <mesh
        ref={crystalRef}
        geometry={CRYSTAL_GEO}
        material={CRYSTAL_MAT}
        position={[0, 140, 0]}
      />
    </group>
  )
}
