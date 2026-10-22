import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import StaticInstances from './shared/StaticInstances'

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

/** Instance matrix from position, Euler rotation and scale. */
function placed(
  [x, y, z]: [number, number, number],
  [rx, ry, rz]: [number, number, number] = [0, 0, 0],
  [sx, sy, sz]: [number, number, number] = [1, 1, 1],
): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  )
}

/** Matrices for every repeated part, laid out once per mount (one draw call per part). */
function layoutCity() {
  // Column ring: 12 columns, some broken; caps on the tall ones
  const columns: THREE.Matrix4[] = []
  const caps: THREE.Matrix4[] = []
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    const x = Math.cos(angle) * 130
    const z = Math.sin(angle) * 130
    const height = Math.random() > 0.5 ? 30 + Math.random() * 40 : 90
    columns.push(placed([x, height / 2 - 30, z], undefined, [1, height, 1]))
    if (height > 60) caps.push(placed([x, height - 30, z]))
  }

  const arches: THREE.Matrix4[] = []
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    arches.push(placed([Math.cos(angle) * 130, 25, Math.sin(angle) * 130], [0, angle + Math.PI / 2, 0]))
  }

  // Broken wall sections
  const walls: THREE.Matrix4[] = []
  for (let i = 0; i < 6; i++) {
    const angle = ((i + 0.5) / 6) * Math.PI * 2
    const height = 20 + Math.random() * 30
    walls.push(
      placed(
        [Math.cos(angle) * 160, height / 2 - 25, Math.sin(angle) * 160],
        [0, angle, Math.random() * 0.1],
        [1, height / 40, 1],
      ),
    )
  }

  // Floor slabs (tilted for ruin feel)
  const floors = [
    placed([40, -30, 30], [0.08, 0.2, 0.04]),
    placed([-50, -35, -20], [-0.05, -0.4, 0.03], [0.7, 1, 0.8]),
  ]

  // Glowing runes on the dome surface, then on the columns
  const runes: THREE.Matrix4[] = []
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    runes.push(placed([Math.cos(angle) * 145, -10 + Math.random() * 40, Math.sin(angle) * 145], [0, angle, 0]))
  }
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    runes.push(placed([Math.cos(angle) * 128, 10 + Math.random() * 20, Math.sin(angle) * 128], [0, angle, 0]))
  }

  return { columns, caps, arches, walls, floors, runes }
}

/**
 * Massive partially-submerged Atlantis-style ruins.
 * Central dome, ring of columns (some broken), archways, walls, glowing runes, crystal.
 */
export default function SunkenCity({ position }: SunkenCityProps) {
  const crystalRef = useRef<THREE.Mesh>(null)
  const city = useMemo(() => layoutCity(), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // Rotate floating crystal
    if (crystalRef.current) {
      crystalRef.current.rotation.y = t * 0.5
      crystalRef.current.position.y = 80 + Math.sin(t * 0.8) * 5
    }
    // Pulse rune glow (one material shared by every rune)
    RUNE_MAT.emissiveIntensity = 3 + Math.sin(t * 1.5) * 2.0
  })

  return (
    <group position={position}>
      {/* Central dome */}
      <mesh geometry={DOME_GEO} material={DOME_MAT} position={[0, -20, 0]} />

      <StaticInstances matrices={city.floors} geometry={FLOOR_GEO} material={FLOOR_MAT} />
      <StaticInstances matrices={city.columns} geometry={COLUMN_GEO} material={COLUMN_MAT} />
      <StaticInstances matrices={city.caps} geometry={PILLAR_CAP_GEO} material={STONE_MAT} />
      <StaticInstances matrices={city.arches} geometry={ARCH_GEO} material={STONE_MAT} />
      <StaticInstances matrices={city.walls} geometry={WALL_GEO} material={WALL_MAT} />
      <StaticInstances matrices={city.runes} geometry={RUNE_GEO} material={RUNE_MAT} />

      {/* Floating crystal above dome — large, bright, visible above water */}
      <mesh ref={crystalRef} geometry={CRYSTAL_GEO} material={CRYSTAL_MAT} position={[0, 80, 0]} />
    </group>
  )
}
