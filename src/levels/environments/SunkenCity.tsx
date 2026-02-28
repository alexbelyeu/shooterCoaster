import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface SunkenCityProps {
  position: [number, number, number]
}

// Shared geometries — scaled up for visibility
const COLUMN_GEO = new THREE.CylinderGeometry(8, 10, 1, 6)
const DOME_GEO = new THREE.SphereGeometry(150, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2)
const ARCH_GEO = new THREE.TorusGeometry(50, 6, 6, 12, Math.PI)
const FLOOR_GEO = new THREE.BoxGeometry(250, 6, 160)
const RUNE_GEO = new THREE.BoxGeometry(8, 12, 1)
const CRYSTAL_GEO = new THREE.OctahedronGeometry(18, 0)
const PILLAR_CAP_GEO = new THREE.CylinderGeometry(12, 8, 8, 6)
const WALL_GEO = new THREE.BoxGeometry(80, 40, 6)

// Materials — brighter to be visible underwater
const STONE_MAT = new THREE.MeshPhongMaterial({ color: '#7a9a8a', flatShading: true })
const COLUMN_MAT = new THREE.MeshPhongMaterial({ color: '#8aaa9a', flatShading: true })
const FLOOR_MAT = new THREE.MeshPhongMaterial({ color: '#6a8a7a', flatShading: true })
const DOME_MAT = new THREE.MeshPhongMaterial({
  color: '#6a9a8a',
  flatShading: true,
  transparent: true,
  opacity: 0.6,
  side: THREE.DoubleSide,
})
const RUNE_MAT = new THREE.MeshStandardMaterial({
  color: '#00ffaa',
  emissive: '#00ffaa',
  emissiveIntensity: 4,
  toneMapped: false,
})
const CRYSTAL_MAT = new THREE.MeshStandardMaterial({
  color: '#40e0d0',
  emissive: '#00ffcc',
  emissiveIntensity: 5,
  toneMapped: false,
  transparent: true,
  opacity: 0.9,
})
const WALL_MAT = new THREE.MeshPhongMaterial({ color: '#5a7a6a', flatShading: true })

/**
 * Massive partially-submerged Atlantis-style ruins.
 * Central dome, ring of columns (some broken), archways, walls, glowing runes, crystal.
 */
export default function SunkenCity({ position }: SunkenCityProps) {
  const crystalRef = useRef<THREE.Mesh>(null)
  const runeRefs = useRef<THREE.Mesh[]>([])

  // Column ring: 12 columns, some broken
  const columns = useMemo(() => {
    const arr: { x: number; z: number; height: number }[] = []
    const count = 12
    const radius = 130
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const broken = Math.random() > 0.5
      arr.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        height: broken ? 30 + Math.random() * 40 : 90,
      })
    }
    return arr
  }, [])

  // Archways
  const arches = useMemo(() => {
    const arr: { x: number; z: number; angle: number }[] = []
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2
      const radius = 130
      arr.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        angle: angle + Math.PI / 2,
      })
    }
    return arr
  }, [])

  // Broken wall sections
  const walls = useMemo(() => {
    const arr: { x: number; z: number; angle: number; height: number }[] = []
    for (let i = 0; i < 6; i++) {
      const angle = ((i + 0.5) / 6) * Math.PI * 2
      const radius = 160
      arr.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        angle,
        height: 20 + Math.random() * 30,
      })
    }
    return arr
  }, [])

  // Glowing runes scattered across the structure
  const runes = useMemo(() => {
    const arr: { x: number; y: number; z: number; ry: number }[] = []
    // Runes on dome surface
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const r = 145
      arr.push({
        x: Math.cos(angle) * r,
        y: -10 + Math.random() * 40,
        z: Math.sin(angle) * r,
        ry: angle,
      })
    }
    // Runes on columns
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const r = 128
      arr.push({
        x: Math.cos(angle) * r,
        y: 10 + Math.random() * 20,
        z: Math.sin(angle) * r,
        ry: angle,
      })
    }
    return arr
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // Rotate floating crystal
    if (crystalRef.current) {
      crystalRef.current.rotation.y = t * 0.5
      crystalRef.current.position.y = 80 + Math.sin(t * 0.8) * 5
    }
    // Pulse rune glow
    const intensity = 3 + Math.sin(t * 1.5) * 2.0
    for (const rune of runeRefs.current) {
      if (rune?.material && (rune.material as THREE.MeshStandardMaterial).emissiveIntensity !== undefined) {
        (rune.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity
      }
    }
  })

  return (
    <group position={position}>
      {/* Central dome */}
      <mesh geometry={DOME_GEO} material={DOME_MAT} position={[0, -20, 0]} />

      {/* Floor slabs (tilted for ruin feel) */}
      <mesh geometry={FLOOR_GEO} material={FLOOR_MAT} position={[40, -30, 30]} rotation={[0.08, 0.2, 0.04]} />
      <mesh geometry={FLOOR_GEO} material={FLOOR_MAT} position={[-50, -35, -20]} rotation={[-0.05, -0.4, 0.03]} scale={[0.7, 1, 0.8]} />

      {/* Columns */}
      {columns.map((col, i) => (
        <group key={`col-${i}`}>
          <mesh
            geometry={COLUMN_GEO}
            material={COLUMN_MAT}
            position={[col.x, col.height / 2 - 30, col.z]}
            scale={[1, col.height, 1]}
          />
          {/* Column cap for tall columns */}
          {col.height > 60 && (
            <mesh
              geometry={PILLAR_CAP_GEO}
              material={STONE_MAT}
              position={[col.x, col.height - 30, col.z]}
            />
          )}
        </group>
      ))}

      {/* Archways */}
      {arches.map((arch, i) => (
        <mesh
          key={`arch-${i}`}
          geometry={ARCH_GEO}
          material={STONE_MAT}
          position={[arch.x, 25, arch.z]}
          rotation={[0, arch.angle, 0]}
        />
      ))}

      {/* Broken wall sections */}
      {walls.map((wall, i) => (
        <mesh
          key={`wall-${i}`}
          geometry={WALL_GEO}
          material={WALL_MAT}
          position={[wall.x, wall.height / 2 - 25, wall.z]}
          rotation={[0, wall.angle, Math.random() * 0.1]}
          scale={[1, wall.height / 40, 1]}
        />
      ))}

      {/* Glowing runes */}
      {runes.map((rune, i) => (
        <mesh
          key={`rune-${i}`}
          ref={(el) => { if (el) runeRefs.current[i] = el }}
          geometry={RUNE_GEO}
          material={RUNE_MAT}
          position={[rune.x, rune.y, rune.z]}
          rotation={[0, rune.ry, 0]}
        />
      ))}

      {/* Floating crystal above dome — large, bright, visible above water */}
      <mesh ref={crystalRef} geometry={CRYSTAL_GEO} material={CRYSTAL_MAT} position={[0, 80, 0]} />
    </group>
  )
}
