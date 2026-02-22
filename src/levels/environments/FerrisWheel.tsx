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

  useFrame((_, delta) => {
    if (wheelRef.current) {
      wheelRef.current.rotation.z += ROTATION_SPEED * delta
      const wheelAngle = wheelRef.current.rotation.z
      for (let i = 0; i < gondolaRefs.current.length; i++) {
        const g = gondolaRefs.current[i]
        if (g) g.rotation.z = -wheelAngle
      }
    }
  })

  const hubY = radius + 10
  const legSpread = radius * 0.7 // wide base for a proper A-frame
  const zGap = 8 // distance between front and back frames

  // Leg from foot (±legSpread/2, 0) to hub (0, hubY)
  const legLength = Math.sqrt((legSpread / 2) ** 2 + hubY ** 2)
  const legAngle = Math.atan2(legSpread / 2, hubY)

  return (
    <group position={position}>
      {/* ---- A-FRAME SUPPORTS (front & back) ---- */}
      {[zGap / 2, -zGap / 2].map((z, zi) => (
        <group key={`frame-${zi}`}>
          {/* Left leg — foot at (-legSpread/2, 0), top at (0, hubY) */}
          <mesh
            position={[-legSpread / 4, hubY / 2, z]}
            rotation={[0, 0, -legAngle]}
          >
            <boxGeometry args={[2.5, legLength, 2.5]} />
            <meshPhongMaterial color="#555555" flatShading />
          </mesh>
          {/* Right leg — foot at (+legSpread/2, 0), top at (0, hubY) */}
          <mesh
            position={[legSpread / 4, hubY / 2, z]}
            rotation={[0, 0, legAngle]}
          >
            <boxGeometry args={[2.5, legLength, 2.5]} />
            <meshPhongMaterial color="#555555" flatShading />
          </mesh>
          {/* Lower cross brace */}
          <mesh position={[0, hubY * 0.3, z]}>
            <boxGeometry args={[legSpread * 0.45, 1.5, 1.5]} />
            <meshPhongMaterial color="#444444" flatShading />
          </mesh>
          {/* Upper cross brace */}
          <mesh position={[0, hubY * 0.6, z]}>
            <boxGeometry args={[legSpread * 0.22, 1.5, 1.5]} />
            <meshPhongMaterial color="#444444" flatShading />
          </mesh>
        </group>
      ))}

      {/* Horizontal braces connecting front and back frames */}
      {[-legSpread * 0.35, legSpread * 0.35].map((x, xi) => (
        <mesh key={`zbrace-${xi}`} position={[x, 2, 0]}>
          <boxGeometry args={[1.5, 1.5, zGap + 2]} />
          <meshPhongMaterial color="#444444" flatShading />
        </mesh>
      ))}

      {/* Base platform */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[legSpread * 0.85, 1, zGap + 4]} />
        <meshPhongMaterial color="#666666" flatShading />
      </mesh>

      {/* Hub axle */}
      <mesh position={[0, hubY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3.5, 3.5, zGap + 4, 8]} />
        <meshPhongMaterial color="#888888" flatShading />
      </mesh>
      {/* Hub caps */}
      <mesh position={[0, hubY, zGap / 2 + 2.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[5, 5, 1, 8]} />
        <meshPhongMaterial color="#aaaaaa" flatShading />
      </mesh>
      <mesh position={[0, hubY, -(zGap / 2 + 2.5)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[5, 5, 1, 8]} />
        <meshPhongMaterial color="#aaaaaa" flatShading />
      </mesh>

      {/* Rotating wheel group */}
      <group ref={wheelRef} position={[0, hubY, 0]}>
        {/* Outer rim (two rings for front/back) */}
        <mesh position={[0, 0, zGap / 2]}>
          <torusGeometry args={[radius, 1.5, 6, 36]} />
          <meshPhongMaterial color="#cc3333" flatShading />
        </mesh>
        <mesh position={[0, 0, -zGap / 2]}>
          <torusGeometry args={[radius, 1.5, 6, 36]} />
          <meshPhongMaterial color="#cc3333" flatShading />
        </mesh>

        {/* Spokes */}
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
            <cylinderGeometry args={[0.5, 0.5, radius, 4]} />
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
              <cylinderGeometry args={[0.8, 0.8, zGap + 2, 4]} />
              <meshPhongMaterial color="#777777" flatShading />
            </mesh>

            {/* Gondola group — counter-rotated to hang down */}
            <group ref={(el) => { gondolaRefs.current[i] = el }}>
              {/* Hanging arms (two) */}
              <mesh position={[-2.5, -5, 0]}>
                <cylinderGeometry args={[0.3, 0.3, 6, 4]} />
                <meshPhongMaterial color="#666666" flatShading />
              </mesh>
              <mesh position={[2.5, -5, 0]}>
                <cylinderGeometry args={[0.3, 0.3, 6, 4]} />
                <meshPhongMaterial color="#666666" flatShading />
              </mesh>
              {/* Cabin roof */}
              <mesh position={[0, -8, 0]}>
                <boxGeometry args={[8, 0.8, 6]} />
                <meshPhongMaterial color="#dddddd" flatShading />
              </mesh>
              {/* Cabin body */}
              <mesh position={[0, -11.5, 0]}>
                <boxGeometry args={[7, 6, 5]} />
                <meshPhongMaterial color={GONDOLA_COLORS[i % GONDOLA_COLORS.length]} flatShading />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}
