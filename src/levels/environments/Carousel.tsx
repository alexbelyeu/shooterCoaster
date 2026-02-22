import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface CarouselProps {
  position?: [number, number, number]
  radius?: number
  horseCount?: number
}

const ROTATION_SPEED = 0.3 // rad/s

/**
 * Animated carousel: cone roof + cylinder base + bobbing horses.
 */
export default function Carousel({
  position = [0, 0, 0],
  radius = 25,
  horseCount = 8,
}: CarouselProps) {
  const platformRef = useRef<THREE.Group>(null)
  const timeRef = useRef(0)

  const horses = useMemo(() => {
    const arr: { angle: number; color: string; phase: number }[] = []
    const colors = ['#ff4444', '#ffcc00', '#4488ff', '#44cc44', '#ff44ff', '#ffffff', '#ff8800', '#cc33ff']
    for (let i = 0; i < horseCount; i++) {
      arr.push({
        angle: (i / horseCount) * Math.PI * 2,
        color: colors[i % colors.length],
        phase: (i / horseCount) * Math.PI * 2,
      })
    }
    return arr
  }, [horseCount])

  useFrame((_, delta) => {
    if (platformRef.current) {
      platformRef.current.rotation.y += ROTATION_SPEED * delta
    }
    timeRef.current += delta
  })

  return (
    <group position={position}>
      {/* Central pole */}
      <mesh position={[0, 20, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 40, 8]} />
        <meshPhongMaterial color="#cccccc" flatShading />
      </mesh>

      {/* Cone roof */}
      <mesh position={[0, 38, 0]}>
        <coneGeometry args={[radius + 5, 12, 12]} />
        <meshPhongMaterial color="#ff3333" flatShading />
      </mesh>

      {/* Rotating platform with horses */}
      <group ref={platformRef}>
        {/* Base cylinder */}
        <mesh position={[0, 2, 0]}>
          <cylinderGeometry args={[radius, radius, 4, 16]} />
          <meshPhongMaterial color="#ddaa44" flatShading />
        </mesh>

        {/* Horses */}
        {horses.map((horse, i) => {
          const x = Math.cos(horse.angle) * (radius * 0.7)
          const z = Math.sin(horse.angle) * (radius * 0.7)
          const bob = Math.sin(timeRef.current * 2 + horse.phase) * 3

          return (
            <group key={i} position={[x, 10 + bob, z]}>
              {/* Pole */}
              <mesh position={[0, 8, 0]}>
                <cylinderGeometry args={[0.5, 0.5, 20, 4]} />
                <meshPhongMaterial color="#cccccc" flatShading />
              </mesh>
              {/* Horse body — simplified as a box */}
              <mesh>
                <boxGeometry args={[6, 5, 3]} />
                <meshPhongMaterial color={horse.color} flatShading />
              </mesh>
              {/* Horse head */}
              <mesh position={[4, 2, 0]}>
                <boxGeometry args={[3, 3, 2]} />
                <meshPhongMaterial color={horse.color} flatShading />
              </mesh>
            </group>
          )
        })}
      </group>
    </group>
  )
}
