import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface PyramidProps {
  position?: [number, number, number]
}

const LAYER_COUNT = 8
const BASE_SIZE = 800
const LAYER_HEIGHT = 80
const SHRINK = 0.82

/**
 * Massive stepped pyramid with glowing hieroglyphic panels
 * and a rotating golden capstone.
 */
export default function Pyramid({ position = [800, 0, -600] }: PyramidProps) {
  const capstoneRef = useRef<THREE.Mesh>(null)
  const glyphRefs = useRef<(THREE.Mesh | null)[]>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // Rotate capstone
    if (capstoneRef.current) {
      capstoneRef.current.rotation.y = t * 0.5
    }
    // Pulse hieroglyph emissive intensity
    const pulse = 1.2 + Math.sin(t * 1.5) * 0.8
    for (const mesh of glyphRefs.current) {
      if (mesh) {
        const mat = mesh.material as THREE.MeshStandardMaterial
        mat.emissiveIntensity = pulse
      }
    }
  })

  const layers = useMemo(() => {
    const arr: { size: number; y: number; color: string }[] = []
    let size = BASE_SIZE
    let y = 0
    for (let i = 0; i < LAYER_COUNT; i++) {
      const t = i / (LAYER_COUNT - 1)
      const r = Math.round(184 - t * 30)
      const g = Math.round(154 - t * 10)
      const b = Math.round(80 + t * 20)
      arr.push({
        size,
        y: y + LAYER_HEIGHT / 2,
        color: `rgb(${r}, ${g}, ${b})`,
      })
      y += LAYER_HEIGHT
      size *= SHRINK
    }
    return arr
  }, [])

  // Glyph panels on alternating layers (front and back faces)
  const glyphs = useMemo(() => {
    const arr: { x: number; y: number; z: number; w: number; h: number; rotY: number }[] = []
    for (let i = 1; i < LAYER_COUNT; i += 2) {
      const layer = layers[i]
      const s = layer.size * 0.5 + 1
      const w = layer.size * 0.3
      const h = LAYER_HEIGHT * 0.6
      // Front face
      arr.push({ x: 0, y: layer.y, z: s, w, h, rotY: 0 })
      // Right face
      arr.push({ x: s, y: layer.y, z: 0, w, h, rotY: Math.PI / 2 })
    }
    return arr
  }, [layers])

  const totalHeight = layers[layers.length - 1].y + LAYER_HEIGHT / 2

  return (
    <group position={position}>
      {/* Pyramid layers */}
      {layers.map((layer, i) => (
        <mesh key={`layer-${i}`} position={[0, layer.y, 0]}>
          <boxGeometry args={[layer.size, LAYER_HEIGHT, layer.size]} />
          <meshPhongMaterial color={layer.color} flatShading />
        </mesh>
      ))}

      {/* Hieroglyphic panels */}
      {glyphs.map((g, i) => (
        <mesh
          key={`glyph-${i}`}
          ref={(el) => { glyphRefs.current[i] = el }}
          position={[g.x, g.y, g.z]}
          rotation={[0, g.rotY, 0]}
        >
          <boxGeometry args={[g.w, g.h, 2]} />
          <meshStandardMaterial
            color="#ffaa00"
            emissive="#ffaa00"
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Capstone */}
      <mesh
        ref={capstoneRef}
        position={[0, totalHeight + 40, 0]}
      >
        <octahedronGeometry args={[50, 0]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#ffd700"
          emissiveIntensity={2.5}
          metalness={0.7}
          roughness={0.2}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
