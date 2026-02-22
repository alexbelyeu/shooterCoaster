import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface FerrisWheelProps {
  position?: [number, number, number]
  radius?: number
  gondolaCount?: number
}

const ROTATION_SPEED = 0.1 // rad/s

/**
 * Animated Ferris wheel: torus frame + radial spokes + hanging gondolas.
 */
export default function FerrisWheel({
  position = [0, 0, 0],
  radius = 80,
  gondolaCount = 12,
}: FerrisWheelProps) {
  const wheelRef = useRef<THREE.Group>(null)

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
    }
  })

  return (
    <group position={position}>
      {/* Support legs */}
      <mesh position={[-15, radius * 0.5, 0]} rotation={[0, 0, 0.15]}>
        <boxGeometry args={[3, radius * 1.1, 3]} />
        <meshPhongMaterial color="#666666" flatShading />
      </mesh>
      <mesh position={[15, radius * 0.5, 0]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[3, radius * 1.1, 3]} />
        <meshPhongMaterial color="#666666" flatShading />
      </mesh>

      {/* Rotating wheel */}
      <group ref={wheelRef} position={[0, radius + 5, 0]}>
        {/* Outer ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 2, 8, 32]} />
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
            rotation={[0, 0, angle]}
          >
            <boxGeometry args={[radius, 1.5, 1.5]} />
            <meshPhongMaterial color="#999999" flatShading />
          </mesh>
        ))}

        {/* Gondolas — counter-rotate so they hang down */}
        {gondolaAngles.map((angle, i) => {
          const colors = ['#ff4444', '#4488ff', '#ffcc00', '#44cc44', '#ff44ff', '#ffffff']
          return (
            <group
              key={`gondola-${i}`}
              position={[
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                0,
              ]}
            >
              {/* Gondola cabin */}
              <mesh position={[0, -8, 0]}>
                <boxGeometry args={[10, 10, 8]} />
                <meshPhongMaterial color={colors[i % colors.length]} flatShading />
              </mesh>
            </group>
          )
        })}
      </group>
    </group>
  )
}
