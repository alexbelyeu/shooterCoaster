import { useRef, useMemo, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'

const POOL_SIZE = 350
const FIRE_DELAY_MS = 100
const BULLET_LIFETIME_MS = 5000
const BULLET_SPEED = 8

interface Bullet {
  alive: boolean
  bornAt: number
  position: THREE.Vector3
  direction: THREE.Vector3
  speed: number
}

interface BulletPoolHandle {
  fire: (origin: THREE.Vector3, direction: THREE.Vector3) => void
  getLiveBullets: () => Bullet[]
}

// Singleton ref for external access
let poolHandle: BulletPoolHandle | null = null
export function getBulletPool(): BulletPoolHandle | null {
  return poolHandle
}

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

  const lastFireTime = useRef(0)
  const tempMatrix = useMemo(() => new THREE.Matrix4(), [])
  const tempColor = useMemo(() => new THREE.Color(bulletColor), [bulletColor])

  const fire = useCallback(
    (origin: THREE.Vector3, direction: THREE.Vector3) => {
      const now = performance.now()
      if (now - lastFireTime.current < FIRE_DELAY_MS) return

      lastFireTime.current = now

      const bullet = bullets.find((b) => !b.alive)
      if (!bullet) return

      bullet.alive = true
      bullet.bornAt = now
      bullet.position.copy(origin)
      bullet.direction.copy(direction).normalize()
      bullet.speed = BULLET_SPEED
    },
    [bullets],
  )

  const getLiveBullets = useCallback(() => bullets.filter((b) => b.alive), [bullets])

  // Expose the pool handle
  poolHandle = { fire, getLiveBullets }

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

      tempMatrix.makeTranslation(bullet.position.x, bullet.position.y, bullet.position.z)

      if (bullet.alive) {
        const scale = bulletSize * 0.1
        tempMatrix.makeTranslation(bullet.position.x, bullet.position.y, bullet.position.z)
        tempMatrix.scale(new THREE.Vector3(scale, scale, scale))
      } else {
        tempMatrix.makeTranslation(0, -9999, 0)
        tempMatrix.scale(new THREE.Vector3(0, 0, 0))
      }

      meshRef.current.setMatrixAt(i, tempMatrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
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
