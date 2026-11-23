import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LAMP_WARM } from './shared/lampGlow'
import StaticInstances from './shared/StaticInstances'
import {
  PYRAMID_BASE_SIZE,
  PYRAMID_HEIGHT,
  PYRAMID_LAYER_COUNT,
  PYRAMID_LAYER_HEIGHT,
  PYRAMID_SHRINK,
} from './landmarkDimensions'

interface PyramidProps {
  position?: [number, number, number]
  /** The atmosphere's `lampGlow`: torches burning on every layer's corners and the stone warm under them at night (#880). */
  lampGlow?: number
}

/** A torch's flame: a cone standing on its base, sized to read from the ride a couple of kilometres off. */
const TORCH_RADIUS = 10
const TORCH_HEIGHT = 34

/** One torch on each top corner of every layer, inset a little so it stands on the step. */
function torchMatrices(): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = []
  let size = PYRAMID_BASE_SIZE
  for (let i = 0; i < PYRAMID_LAYER_COUNT; i++) {
    const h = size * 0.5 - TORCH_RADIUS
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      out.push(new THREE.Matrix4().makeTranslation(sx * h, (i + 1) * PYRAMID_LAYER_HEIGHT, sz * h))
    }
    size *= PYRAMID_SHRINK
  }
  return out
}

/** The torches: one instanced draw, past white so Bloom takes them, flickering together. */
function Torches({ glow }: { glow: number }) {
  const assets = useMemo(() => {
    const geometry = new THREE.ConeGeometry(TORCH_RADIUS, TORCH_HEIGHT, 6).translate(0, TORCH_HEIGHT / 2, 0)
    const material = new THREE.MeshBasicMaterial({ toneMapped: false })
    return { geometry, material, matrices: torchMatrices() }
  }, [])
  useEffect(() => () => {
    assets.geometry.dispose()
    assets.material.dispose()
  }, [assets])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const flicker = glow * (1.5 + 0.2 * Math.sin(t * 9.1) + 0.15 * Math.sin(t * 23.7))
    assets.material.color.setRGB(flicker, flicker * 0.42, flicker * 0.08)
  })

  return <StaticInstances matrices={assets.matrices} geometry={assets.geometry} material={assets.material} />
}

/** Stepped pyramid with glowing hieroglyph panels and a spinning golden capstone. */
export default function Pyramid({ position = [800, 0, -600], lampGlow = 0 }: PyramidProps) {
  const capstoneRef = useRef<THREE.Mesh>(null)
  const glyphRefs = useRef<(THREE.Mesh | null)[]>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (capstoneRef.current) {
      capstoneRef.current.rotation.y = t * 0.5
    }
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
    let size = PYRAMID_BASE_SIZE
    let y = 0
    for (let i = 0; i < PYRAMID_LAYER_COUNT; i++) {
      const t = i / (PYRAMID_LAYER_COUNT - 1)
      const r = Math.round(184 - t * 30)
      const g = Math.round(154 - t * 10)
      const b = Math.round(80 + t * 20)
      arr.push({
        size,
        y: y + PYRAMID_LAYER_HEIGHT / 2,
        color: `rgb(${r}, ${g}, ${b})`,
      })
      y += PYRAMID_LAYER_HEIGHT
      size *= PYRAMID_SHRINK
    }
    return arr
  }, [])

  // On alternating layers, front and right faces.
  const glyphs = useMemo(() => {
    const arr: { x: number; y: number; z: number; w: number; h: number; rotY: number }[] = []
    for (let i = 1; i < PYRAMID_LAYER_COUNT; i += 2) {
      const layer = layers[i]
      const s = layer.size * 0.5 + 1
      const w = layer.size * 0.3
      const h = PYRAMID_LAYER_HEIGHT * 0.6
      arr.push({ x: 0, y: layer.y, z: s, w, h, rotY: 0 })
      arr.push({ x: s, y: layer.y, z: 0, w, h, rotY: Math.PI / 2 })
    }
    return arr
  }, [layers])

  return (
    <group position={position}>
      {layers.map((layer, i) => (
        <mesh key={`layer-${i}`} position={[0, layer.y, 0]}>
          <boxGeometry args={[layer.size, PYRAMID_LAYER_HEIGHT, layer.size]} />
          <meshPhongMaterial color={layer.color} emissive={LAMP_WARM} emissiveIntensity={0.08 * lampGlow} flatShading />
        </mesh>
      ))}

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

      <mesh
        ref={capstoneRef}
        position={[0, PYRAMID_HEIGHT + 40, 0]}
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

      {lampGlow > 0 && <Torches glow={lampGlow} />}
    </group>
  )
}
