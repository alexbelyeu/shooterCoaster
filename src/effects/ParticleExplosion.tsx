import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { randomRange, randomRangeLow } from '@/utils/math'

interface ParticleExplosionProps {
  position: THREE.Vector3
  color?: string
  count?: number
  speed?: number
}

const GRAVITY = -0.06 // per frame at 60fps

/**
 * Two-layer explosion: fire core (emissive, slow) + white sparks (fast, gravity-affected).
 * Includes a brief pointLight flash for bloom interaction.
 */
export default function ParticleExplosion({
  position,
  color = '#ff4444',
  count = 60,
  speed = 3,
}: ParticleExplosionProps) {
  const fireRef = useRef<THREE.InstancedMesh>(null)
  const sparkRef = useRef<THREE.InstancedMesh>(null)
  const startTime = useRef(performance.now())
  const [lightIntensity, setLightIntensity] = useState(8)

  const sparkCount = Math.floor(count * 0.5)

  const fireParticles = useMemo(() => {
    const arr: { pos: THREE.Vector3; vel: THREE.Vector3 }[] = []
    for (let i = 0; i < count; i++) {
      const theta = randomRange(0, 2 * Math.PI)
      const phi = randomRange(0, Math.PI)
      const r = randomRangeLow(0, speed * 0.7)
      arr.push({
        pos: position.clone(),
        vel: new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi),
        ),
      })
    }
    return arr
  }, [position, count, speed])

  const sparkParticles = useMemo(() => {
    const arr: { pos: THREE.Vector3; vel: THREE.Vector3 }[] = []
    for (let i = 0; i < sparkCount; i++) {
      const theta = randomRange(0, 2 * Math.PI)
      const phi = randomRange(0, Math.PI)
      const r = randomRange(speed * 0.5, speed * 1.5)
      arr.push({
        pos: position.clone(),
        vel: new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta) + randomRange(1, 3),
          r * Math.cos(phi),
        ),
      })
    }
    return arr
  }, [position, sparkCount, speed])

  const tempMatrix = useMemo(() => new THREE.Matrix4(), [])

  useFrame(() => {
    const elapsed = (performance.now() - startTime.current) / 1000
    const fade = Math.max(0, 1 - elapsed / 1.5)

    // Flash fades quickly
    if (elapsed < 0.15) {
      setLightIntensity(8 * (1 - elapsed / 0.15))
    } else if (lightIntensity > 0) {
      setLightIntensity(0)
    }

    // Fire core
    if (fireRef.current) {
      for (let i = 0; i < count; i++) {
        const p = fireParticles[i]
        p.pos.addScaledVector(p.vel, 0.95)
        p.vel.multiplyScalar(0.96)

        const scale = fade * 1.2
        tempMatrix.makeTranslation(p.pos.x, p.pos.y, p.pos.z)
        tempMatrix.scale(new THREE.Vector3(scale, scale, scale))
        fireRef.current.setMatrixAt(i, tempMatrix)
      }
      fireRef.current.instanceMatrix.needsUpdate = true
    }

    // White sparks with gravity
    if (sparkRef.current) {
      for (let i = 0; i < sparkCount; i++) {
        const p = sparkParticles[i]
        p.pos.addScaledVector(p.vel, 0.95)
        p.vel.y += GRAVITY
        p.vel.multiplyScalar(0.98)

        const scale = fade * 0.5
        tempMatrix.makeTranslation(p.pos.x, p.pos.y, p.pos.z)
        tempMatrix.scale(new THREE.Vector3(scale, scale, scale))
        sparkRef.current.setMatrixAt(i, tempMatrix)
      }
      sparkRef.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      {/* Brief flash for bloom */}
      <pointLight
        position={[position.x, position.y, position.z]}
        color={color}
        intensity={lightIntensity}
        distance={200}
        decay={2}
      />

      {/* Fire core — emissive, warm */}
      <instancedMesh ref={fireRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3}
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </instancedMesh>

      {/* White sparks — bright, small, gravity-affected */}
      <instancedMesh ref={sparkRef} args={[undefined, undefined, sparkCount]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={4}
          transparent
          opacity={0.95}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  )
}
