import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface FerrisWheelProps {
  position?: [number, number, number]
  radius?: number
  gondolaCount?: number
}

const ROTATION_SPEED = 0.1 // rad/s
const GONDOLA_COLORS = ['#ff4444', '#4488ff', '#ffcc00', '#44cc44', '#ff44ff', '#ffffff']

/**
 * Animated Ferris wheel with proper A-frame supports,
 * thin spokes, and gondolas that hang downward.
 */
export default function FerrisWheel({
  position = [0, 0, 0],
  radius = 80,
  gondolaCount = 12,
}: FerrisWheelProps) {
  const wheelRef = useRef<THREE.Group>(null)
  const gondolaRefs = useRef<(THREE.Group | null)[]>([])

  const gondolaAngles = useMemo(() => {
    const arr: number[] = []
    for (let i = 0; i < gondolaCount; i++) {
      arr.push((i / gondolaCount) * Math.PI * 2)
    }
    return arr
  }, [gondolaCount])

  // Counter-rotate gondolas so they always hang down
  useFrame((_, delta) => {
    if (wheelRef.current) {
      wheelRef.current.rotation.z += ROTATION_SPEED * delta
      // Counter-rotate each gondola to keep it upright
      const wheelAngle = wheelRef.current.rotation.z
      for (let i = 0; i < gondolaRefs.current.length; i++) {
        const g = gondolaRefs.current[i]
        if (g) g.rotation.z = -wheelAngle
      }
    }
  })

  const hubY = radius + 10 // hub height above ground
  const legHeight = hubY + 5
  const legSpread = radius * 0.3

  return (
    <group position={position}>
      {/* A-frame support legs (front pair) */}
      <mesh
        position={[-legSpread * 0.5, legHeight * 0.5, 6]}
        rotation={[0, 0, Math.atan2(legSpread * 0.5, legHeight)]}
      >
        <boxGeometry args={[2.5, legHeight * 1.02, 2.5]} />
        <meshPhongMaterial color="#555555" flatShading />
      </mesh>
      <mesh
        position={[legSpread * 0.5, legHeight * 0.5, 6]}
        rotation={[0, 0, -Math.atan2(legSpread * 0.5, legHeight)]}
      >
        <boxGeometry args={[2.5, legHeight * 1.02, 2.5]} />
        <meshPhongMaterial color="#555555" flatShading />
      </mesh>

      {/* A-frame support legs (back pair) */}
      <mesh
        position={[-legSpread * 0.5, legHeight * 0.5, -6]}
        rotation={[0, 0, Math.atan2(legSpread * 0.5, legHeight)]}
      >
        <boxGeometry args={[2.5, legHeight * 1.02, 2.5]} />
        <meshPhongMaterial color="#555555" flatShading />
      </mesh>
      <mesh
        position={[legSpread * 0.5, legHeight * 0.5, -6]}
        rotation={[0, 0, -Math.atan2(legSpread * 0.5, legHeight)]}
      >
        <boxGeometry args={[2.5, legHeight * 1.02, 2.5]} />
        <meshPhongMaterial color="#555555" flatShading />
      </mesh>

      {/* Cross brace between legs */}
      <mesh position={[0, legHeight * 0.4, 6]}>
        <boxGeometry args={[legSpread * 1.2, 1.5, 1.5]} />
        <meshPhongMaterial color="#444444" flatShading />
      </mesh>
      <mesh position={[0, legHeight * 0.4, -6]}>
        <boxGeometry args={[legSpread * 1.2, 1.5, 1.5]} />
        <meshPhongMaterial color="#444444" flatShading />
      </mesh>

      {/* Hub axle */}
      <mesh position={[0, hubY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3, 3, 16, 8]} />
        <meshPhongMaterial color="#888888" flatShading />
      </mesh>

      {/* Rotating wheel group */}
      <group ref={wheelRef} position={[0, hubY, 0]}>
        {/* Outer rim (two rings for front/back) */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 4]}>
          <torusGeometry args={[radius, 1.5, 6, 36]} />
          <meshPhongMaterial color="#cc3333" flatShading />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -4]}>
          <torusGeometry args={[radius, 1.5, 6, 36]} />
          <meshPhongMaterial color="#cc3333" flatShading />
        </mesh>

        {/* Spokes — thin cylinders from center to rim */}
        {gondolaAngles.map((angle, i) => (
          <mesh
            key={`spoke-${i}`}
            position={[
              Math.cos(angle) * radius * 0.5,
              Math.sin(angle) * radius * 0.5,
              0,
            ]}
            rotation={[0, 0, angle + Math.PI / 2]}
          >
            <cylinderGeometry args={[0.6, 0.6, radius, 4]} />
            <meshPhongMaterial color="#999999" flatShading />
          </mesh>
        ))}

        {/* Gondola mounting points + gondolas */}
        {gondolaAngles.map((angle, i) => (
          <group
            key={`gondola-mount-${i}`}
            position={[
              Math.cos(angle) * radius,
              Math.sin(angle) * radius,
              0,
            ]}
          >
            {/* Cross-bar between the two rim rings */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.8, 0.8, 10, 4]} />
              <meshPhongMaterial color="#777777" flatShading />
            </mesh>

            {/* Gondola group — counter-rotated to hang down */}
            <group ref={(el) => { gondolaRefs.current[i] = el }}>
              {/* Hanging arm */}
              <mesh position={[0, -5, 0]}>
                <cylinderGeometry args={[0.4, 0.4, 6, 4]} />
                <meshPhongMaterial color="#666666" flatShading />
              </mesh>
              {/* Cabin */}
              <mesh position={[0, -11, 0]}>
                <boxGeometry args={[7, 6, 5]} />
                <meshPhongMaterial color={GONDOLA_COLORS[i % GONDOLA_COLORS.length]} flatShading />
              </mesh>
              {/* Cabin roof */}
              <mesh position={[0, -7.5, 0]}>
                <boxGeometry args={[8, 1, 6]} />
                <meshPhongMaterial color="#dddddd" flatShading />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}
