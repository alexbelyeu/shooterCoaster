import { useRef, useMemo, useCallback, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { getCollisionTargets } from '@/combat/CollisionManager'
import type { Bullet, BulletPoolHandle } from './bulletPoolHandle'
import { setBulletPool } from './bulletPoolHandle'

const POOL_SIZE = 350
const FIRE_DELAY_MS = 60
const BULLET_LIFETIME_MS = 5000
const BULLET_SPEED = 14

interface BulletPoolProps {
  bulletSize?: number
  bulletColor?: string
}

export default function BulletPool({
  bulletSize = 10,
  bulletColor = '#ff0000',
}: BulletPoolProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const phase = useGameStore((s) => s.phase)

  const bullets = useMemo<Bullet[]>(() => {
    const arr: Bullet[] = []
    for (let i = 0; i < POOL_SIZE; i++) {
      arr.push({
        alive: false,
        bornAt: 0,
        position: new THREE.Vector3(0, -9999, 0),
        direction: new THREE.Vector3(0, 0, -1),
        speed: BULLET_SPEED,
      })
    }
    return arr
  }, [])

  const liveBulletBuffer = useRef<Bullet[]>(new Array(POOL_SIZE))
  const liveBulletCount = useRef(0)
  const nextFreeIndex = useRef(0)
  const lastFireTime = useRef(0)
  const tempMatrix = useMemo(() => new THREE.Matrix4(), [])
  const tempColor = useMemo(() => new THREE.Color(bulletColor), [bulletColor])
  const scaleVec = useRef(new THREE.Vector3()).current
  const zeroVec = useRef(new THREE.Vector3(0, 0, 0)).current

  const fire = useCallback(
    (origin: THREE.Vector3, direction: THREE.Vector3) => {
      const now = performance.now()
      if (now - lastFireTime.current < FIRE_DELAY_MS) return

      lastFireTime.current = now

      // Scan from last known free index, wrapping around once
      let bullet: Bullet | null = null
      for (let i = 0; i < POOL_SIZE; i++) {
        const idx = (nextFreeIndex.current + i) % POOL_SIZE
        if (!bullets[idx].alive) {
          bullet = bullets[idx]
          nextFreeIndex.current = (idx + 1) % POOL_SIZE
          break
        }
      }
      if (!bullet) return

      bullet.alive = true
      bullet.bornAt = now
      bullet.position.copy(origin)
      bullet.direction.copy(direction).normalize()
      bullet.speed = BULLET_SPEED
    },
    [bullets],
  )

  const getLiveBullets = useCallback(() => liveBulletBuffer.current, [])
  const getLiveBulletCount = useCallback(() => liveBulletCount.current, [])

  useEffect(() => {
    setBulletPool({ fire, getLiveBullets, getLiveBulletCount })
    return () => setBulletPool(null)
  }, [fire, getLiveBullets, getLiveBulletCount])

  useFrame(() => {
    if (!meshRef.current || phase !== 'playing') return

    const now = performance.now()

    for (let i = 0; i < POOL_SIZE; i++) {
      const bullet = bullets[i]

      if (bullet.alive) {
        if (now - bullet.bornAt > BULLET_LIFETIME_MS) {
          bullet.alive = false
          bullet.position.set(0, -9999, 0)
        } else {
          bullet.position.addScaledVector(bullet.direction, bullet.speed)
        }
      }

      if (bullet.alive) {
        const scale = bulletSize * 0.1
        tempMatrix.makeTranslation(bullet.position.x, bullet.position.y, bullet.position.z)
        scaleVec.set(scale, scale, scale)
        tempMatrix.scale(scaleVec)
      } else {
        tempMatrix.makeTranslation(0, -9999, 0)
        tempMatrix.scale(zeroVec)
      }

      meshRef.current.setMatrixAt(i, tempMatrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true

    // Populate live bullet buffer in-place — no allocation
    let count = 0
    for (let i = 0; i < POOL_SIZE; i++) {
      if (bullets[i].alive) {
        liveBulletBuffer.current[count++] = bullets[i]
      }
    }
    liveBulletCount.current = count

    // Centralized collision pass — flag hits first, process after
    const targets = getCollisionTargets()
    if (targets.size > 0 && count > 0) {
      // Phase 1: pure math — flag hits, no side effects
      for (let b = count - 1; b >= 0; b--) {
        const bullet = liveBulletBuffer.current[b]
        if (!bullet.alive) continue
        for (const target of targets.values()) {
          if (target.hitThisFrame) continue // already hit, skip
          const pos = target.getPosition()
          const dx = pos.x - bullet.position.x
          const dy = pos.y - bullet.position.y
          const dz = pos.z - bullet.position.z
          if (dx * dx + dy * dy + dz * dz < target.radiusSq) {
            bullet.alive = false
            bullet.position.set(0, -9999, 0)
            target.hitThisFrame = true
            break
          }
        }
      }

      // Phase 2: process hits — side effects happen outside the hot loop
      for (const target of targets.values()) {
        if (target.hitThisFrame) {
          target.hitThisFrame = false
          target.onHit()
        }
      }
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, POOL_SIZE]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color={tempColor}
        emissive={tempColor}
        emissiveIntensity={2}
        toneMapped={false}
      />
    </instancedMesh>
  )
}
