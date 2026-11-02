import {
  ARCH_PILLAR_BASE_RADIUS,
  ARCH_PILLAR_HEIGHT,
  ARCH_PILLAR_RADIUS,
  ARCH_RADIUS,
  type ArchConfig,
} from './landmarkDimensions'

/** Stone arches: two pillars under a half torus. */
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
  const pillarHeight = ARCH_PILLAR_HEIGHT * scale
  const archRadius = ARCH_RADIUS * scale
  const pillarRadius = ARCH_PILLAR_RADIUS * scale
  const pillarBase = ARCH_PILLAR_BASE_RADIUS * scale

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[-archRadius, pillarHeight / 2, 0]}>
        <cylinderGeometry args={[pillarRadius, pillarBase, pillarHeight, 6]} />
        <meshPhongMaterial color="#8b5a3a" flatShading />
      </mesh>

      <mesh position={[archRadius, pillarHeight / 2, 0]}>
        <cylinderGeometry args={[pillarRadius, pillarBase, pillarHeight, 6]} />
        <meshPhongMaterial color="#8b5a3a" flatShading />
      </mesh>

      <mesh position={[0, pillarHeight, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[archRadius, pillarRadius * 0.8, 6, 12, Math.PI]} />
        <meshPhongMaterial color="#7a4a2a" flatShading />
      </mesh>

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
