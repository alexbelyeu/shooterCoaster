import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { randomRange, randomRangeLow } from '@/utils/math'
import { setExplosionPool } from './explosionPoolHandle'

const POOL_SLOTS = 5
const FIRE_COUNT = 30
const SPARK_COUNT = 15
const DURATION = 1.5
const GRAVITY = -0.06

// Shared geometries for all explosion slots
const FIRE_GEO = new THREE.BoxGeometry(2, 2, 2)
const SPARK_GEO = new THREE.BoxGeometry(1, 1, 1)

interface ExplosionSlot {
  active: boolean
  needsZero: boolean
  startTime: number
  color: THREE.Color
  firePositions: THREE.Vector3[]
  fireVelocities: THREE.Vector3[]
  sparkPositions: THREE.Vector3[]
  sparkVelocities: THREE.Vector3[]
}

function createSlot(): ExplosionSlot {
  return {
    active: false,
    needsZero: true,
    startTime: 0,
    color: new THREE.Color(),
    firePositions: Array.from({ length: FIRE_COUNT }, () => new THREE.Vector3()),
    fireVelocities: Array.from({ length: FIRE_COUNT }, () => new THREE.Vector3()),
    sparkPositions: Array.from({ length: SPARK_COUNT }, () => new THREE.Vector3()),
    sparkVelocities: Array.from({ length: SPARK_COUNT }, () => new THREE.Vector3()),
  }
}

function initSlot(slot: ExplosionSlot, position: THREE.Vector3, color: string, speed: number = 3) {
  slot.active = true
  slot.startTime = performance.now()
  slot.color.set(color)

  for (let i = 0; i < FIRE_COUNT; i++) {
    slot.firePositions[i].copy(position)
    const theta = randomRange(0, 2 * Math.PI)
    const phi = randomRange(0, Math.PI)
    const r = randomRangeLow(0, speed * 0.7)
    slot.fireVelocities[i].set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    )
  }

  for (let i = 0; i < SPARK_COUNT; i++) {
    slot.sparkPositions[i].copy(position)
    const theta = randomRange(0, 2 * Math.PI)
    const phi = randomRange(0, Math.PI)
    const r = randomRange(speed * 0.5, speed * 1.5)
    slot.sparkVelocities[i].set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) + randomRange(1, 3),
      r * Math.cos(phi),
    )
  }
}

export default function ParticleExplosionPool() {
  const slots = useRef<ExplosionSlot[]>(
    Array.from({ length: POOL_SLOTS }, () => createSlot()),
  ).current

  const fireRefs = useRef<(THREE.InstancedMesh | null)[]>(new Array(POOL_SLOTS).fill(null))
  const sparkRefs = useRef<(THREE.InstancedMesh | null)[]>(new Array(POOL_SLOTS).fill(null))
  const lightRef = useRef<THREE.PointLight>(null)

  const tempMatrix = useMemo(() => new THREE.Matrix4(), [])
  const scaleVec = useRef(new THREE.Vector3()).current
  const zeroScale = useRef(new THREE.Vector3(0, 0, 0)).current

  // Materials for each slot (need per-slot color)
  const fireMats = useRef<THREE.MeshStandardMaterial[]>([]).current
  const sparkMats = useRef<THREE.MeshStandardMaterial[]>([]).current

  const activate = useMemo(
    () => (position: THREE.Vector3, color: string) => {
      // Find inactive slot
      for (let i = 0; i < POOL_SLOTS; i++) {
        if (!slots[i].active) {
          initSlot(slots[i], position, color)
          // Update fire material color
          if (fireMats[i]) {
            fireMats[i].color.set(color)
            fireMats[i].emissive.set(color)
          }
          return
        }
      }
      // All slots active — steal oldest
      let oldest = 0
      let oldestTime = Infinity
      for (let i = 0; i < POOL_SLOTS; i++) {
        if (slots[i].startTime < oldestTime) {
          oldestTime = slots[i].startTime
          oldest = i
        }
      }
      initSlot(slots[oldest], position, color)
      if (fireMats[oldest]) {
        fireMats[oldest].color.set(color)
        fireMats[oldest].emissive.set(color)
      }
    },
    [slots, fireMats],
  )

  useEffect(() => {
    setExplosionPool({ activate })
    return () => setExplosionPool(null)
  }, [activate])

  useFrame(() => {
    const now = performance.now()
    let activeLight = false
    let lightPos: THREE.Vector3 | null = null
    let lightColor: THREE.Color | null = null
    let lightElapsed = 0

    for (let s = 0; s < POOL_SLOTS; s++) {
      const slot = slots[s]
      const fireMesh = fireRefs.current[s]
      const sparkMesh = sparkRefs.current[s]

      if (!fireMesh || !sparkMesh) continue

      if (!slot.active) {
        // Zero out once, then skip entirely
        if (slot.needsZero) {
          tempMatrix.makeScale(0, 0, 0)
          for (let i = 0; i < FIRE_COUNT; i++) {
            fireMesh.setMatrixAt(i, tempMatrix)
          }
          for (let i = 0; i < SPARK_COUNT; i++) {
            sparkMesh.setMatrixAt(i, tempMatrix)
          }
          fireMesh.instanceMatrix.needsUpdate = true
          sparkMesh.instanceMatrix.needsUpdate = true
          slot.needsZero = false
        }
        continue
      }

      const elapsed = (now - slot.startTime) / 1000
      if (elapsed > DURATION) {
        slot.active = false
        slot.needsZero = true
        continue
      }

      const fade = Math.max(0, 1 - elapsed / DURATION)

      // Track light for the most recent active explosion
      if (!activeLight || slot.startTime > (lightElapsed || 0)) {
        activeLight = true
        lightPos = slot.firePositions[0]
        lightColor = slot.color
        lightElapsed = elapsed
      }

      // Fire particles
      for (let i = 0; i < FIRE_COUNT; i++) {
        const pos = slot.firePositions[i]
        const vel = slot.fireVelocities[i]
        pos.addScaledVector(vel, 0.95)
        vel.multiplyScalar(0.96)

        const scale = fade * 1.2
        tempMatrix.makeTranslation(pos.x, pos.y, pos.z)
        scaleVec.set(scale, scale, scale)
        tempMatrix.scale(scaleVec)
        fireMesh.setMatrixAt(i, tempMatrix)
      }
      fireMesh.instanceMatrix.needsUpdate = true

      // Spark particles
      for (let i = 0; i < SPARK_COUNT; i++) {
        const pos = slot.sparkPositions[i]
        const vel = slot.sparkVelocities[i]
        pos.addScaledVector(vel, 0.95)
        vel.y += GRAVITY
        vel.multiplyScalar(0.98)

        const scale = fade * 0.5
        tempMatrix.makeTranslation(pos.x, pos.y, pos.z)
        scaleVec.set(scale, scale, scale)
        tempMatrix.scale(scaleVec)
        sparkMesh.setMatrixAt(i, tempMatrix)
      }
      sparkMesh.instanceMatrix.needsUpdate = true
    }

    // Position shared light
    if (lightRef.current) {
      if (activeLight && lightPos && lightColor) {
        lightRef.current.position.copy(lightPos)
        lightRef.current.color.copy(lightColor)
        if (lightElapsed < 0.04) {
          lightRef.current.intensity = 8 * (lightElapsed / 0.04)
        } else if (lightElapsed < 0.15) {
          lightRef.current.intensity = 8 * (1 - (lightElapsed - 0.04) / 0.11)
        } else {
          lightRef.current.intensity = 0
        }
      } else {
        lightRef.current.intensity = 0
      }
    }
  })

  return (
    <group>
      <pointLight ref={lightRef} intensity={0} distance={200} decay={2} />
      {slots.map((_, i) => (
        <group key={i}>
          <instancedMesh
            ref={(el) => { fireRefs.current[i] = el }}
            args={[FIRE_GEO, undefined, FIRE_COUNT]}
            frustumCulled={false}
          >
            <meshStandardMaterial
              ref={(el) => { if (el) fireMats[i] = el }}
              color="#ff4444"
              emissive="#ff4444"
              emissiveIntensity={3}
              transparent
              opacity={0.9}
              toneMapped={false}
            />
          </instancedMesh>
          <instancedMesh
            ref={(el) => { sparkRefs.current[i] = el }}
            args={[SPARK_GEO, undefined, SPARK_COUNT]}
            frustumCulled={false}
          >
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
      ))}
    </group>
  )
}
