import type { ArchConfig } from './biomes/desert/landmarks'

/**
 * Natural stone arch formations scattered around the desert.
 * Each arch is two pillars with a torus half-arch on top.
 */
export default function RockArches({ arches }: { arches: readonly ArchConfig[] }) {
  return (
    <>
      {arches.map((config, i) => (
        <RockArch
          key={i}
          position={[config.pos[0], config.pos[1], config.pos[2]]}
          rotationY={config.rotY}
          scale={config.scale}
        />
      ))}
    </>
  )
}

function RockArch({
  position,
  rotationY,
  scale,
}: {
  position: [number, number, number]
  rotationY: number
  scale: number
}) {
  const pillarHeight = 200 * scale
  const archRadius = 120 * scale
  const pillarRadius = 20 * scale

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Left pillar */}
      <mesh position={[-archRadius, pillarHeight / 2, 0]}>
        <cylinderGeometry args={[pillarRadius, pillarRadius * 1.3, pillarHeight, 6]} />
        <meshPhongMaterial color="#8b5a3a" flatShading />
      </mesh>

      {/* Right pillar */}
      <mesh position={[archRadius, pillarHeight / 2, 0]}>
        <cylinderGeometry args={[pillarRadius, pillarRadius * 1.3, pillarHeight, 6]} />
        <meshPhongMaterial color="#8b5a3a" flatShading />
      </mesh>

      {/* Arch (top half of a torus) */}
      <mesh position={[0, pillarHeight, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[archRadius, pillarRadius * 0.8, 6, 12, Math.PI]} />
        <meshPhongMaterial color="#7a4a2a" flatShading />
      </mesh>

      {/* Some rubble at the base */}
      {[-1, 1].map((side) => (
        <mesh
          key={`rubble-${side}`}
          position={[side * archRadius * 0.6, 12 * scale, side * 20 * scale]}
        >
          <dodecahedronGeometry args={[15 * scale, 0]} />
          <meshPhongMaterial color="#9a6a4a" flatShading />
        </mesh>
      ))}
    </group>
  )
}
