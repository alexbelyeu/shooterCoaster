import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  PYRAMID_BASE_SIZE,
  PYRAMID_HEIGHT,
  PYRAMID_LAYER_COUNT,
  PYRAMID_LAYER_HEIGHT,
  PYRAMID_SHRINK,
} from './landmarkDimensions'
import { buildDotTexture } from './shared/lampGlow'

interface PyramidProps {
  position?: [number, number, number]
  /** Turned about y. */
  yaw?: number
  /** A passage through tier `layer` along the Pyramid's x (#864): `width` wide, `height` up from the tier's floor, torchlit. */
  passage?: { layer: number; width: number; height: number }
}

/** Torches down each wall of the passage, this far apart along it, this high over its floor. */
const TORCH = { spacing: 110, height: 38, flame: 7, glow: 46 } as const

/** Stepped pyramid with glowing hieroglyph panels and a spinning golden capstone. */
export default function Pyramid({ position = [800, 0, -600], yaw = 0, passage }: PyramidProps) {
  const capstoneRef = useRef<THREE.Mesh>(null)
  const glyphRefs = useRef<(THREE.Mesh | null)[]>([])
  const torchGlow = useRef<THREE.PointsMaterial>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (capstoneRef.current) {
      capstoneRef.current.rotation.y = t * 0.5
    }
    const pulse = 1.2 + Math.sin(t * 1.5) * 0.8
    if (torchGlow.current) torchGlow.current.opacity = 0.75 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07
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
      // Not over the passage's east door.
      if (i !== passage?.layer) arr.push({ x: s, y: layer.y, z: 0, w, h, rotY: Math.PI / 2 })
    }
    return arr
  }, [layers, passage?.layer])

  // The passage's tier as two side blocks and a lintel over the doorway; torches along both walls.
  const cut = useMemo(() => {
    if (!passage) return null
    const layer = layers[passage.layer]
    const side = (layer.size - passage.width) / 2
    const lintel = PYRAMID_LAYER_HEIGHT - passage.height
    const floor = layer.y - PYRAMID_LAYER_HEIGHT / 2
    const blocks = [
      { pos: [0, layer.y, -(passage.width + side) / 2], size: [layer.size, PYRAMID_LAYER_HEIGHT, side] },
      { pos: [0, layer.y, (passage.width + side) / 2], size: [layer.size, PYRAMID_LAYER_HEIGHT, side] },
      { pos: [0, floor + passage.height + lintel / 2, 0], size: [layer.size, lintel, passage.width] },
    ] as { pos: [number, number, number]; size: [number, number, number] }[]
    const torches: number[] = []
    const run = Math.floor((layer.size - TORCH.spacing) / TORCH.spacing)
    for (let k = 0; k <= run; k++) {
      const x = (k - run / 2) * TORCH.spacing
      for (const zSide of [-1, 1]) torches.push(x, floor + TORCH.height, zSide * (passage.width / 2 - 3))
    }
    return { blocks, torches: new Float32Array(torches), dot: buildDotTexture() }
  }, [layers, passage])
  useEffect(() => () => cut?.dot.dispose(), [cut])

  return (
    <group position={position} rotation-y={yaw}>
      {layers.map((layer, i) =>
        cut && i === passage?.layer ? (
          cut.blocks.map((b, k) => (
            <mesh key={`layer-${i}-${k}`} position={b.pos}>
              <boxGeometry args={b.size} />
              <meshPhongMaterial color={layer.color} flatShading />
            </mesh>
          ))
        ) : (
          <mesh key={`layer-${i}`} position={[0, layer.y, 0]}>
            <boxGeometry args={[layer.size, PYRAMID_LAYER_HEIGHT, layer.size]} />
            <meshPhongMaterial color={layer.color} flatShading />
          </mesh>
        ),
      )}

      {cut && (
        <>
          {/* Flames, and their glow round them: emissive, no lights (the dark section's muzzle flash is the only one). */}
          <points>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[cut.torches, 3]} />
            </bufferGeometry>
            <pointsMaterial map={cut.dot} color="#ffe2a0" size={TORCH.flame} transparent depthWrite={false} toneMapped={false} />
          </points>
          <points>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[cut.torches, 3]} />
            </bufferGeometry>
            <pointsMaterial
              ref={torchGlow}
              map={cut.dot}
              color="#ff8a2a"
              size={TORCH.glow}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </points>
        </>
      )}

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
    </group>
  )
}
