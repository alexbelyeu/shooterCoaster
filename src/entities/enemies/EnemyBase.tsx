import { useRef, useState, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { getBulletPool } from '@/combat/projectiles/BulletPool'
import { playExplosionSound } from '@/audio/SFXManager'
import { eventBus } from '@/core/EventBus'
import type { EnemyType } from '@/types/level'

export interface EnemyProps {
  id: string
  spawnPosition: THREE.Vector3
  type: EnemyType
  scoreValue: number
  radius: number
  onKill: (id: string, position: THREE.Vector3) => void
}

interface EnemyBaseProps extends EnemyProps {
  children: React.ReactNode
  updatePosition: (
    mesh: THREE.Object3D,
    spawnPos: THREE.Vector3,
    time: number,
    delta: number,
  ) => void
}

/**
 * Shared base for all enemy types.
 * Handles visibility, collision detection with bullets, and death.
 */
export default function EnemyBase({
  id,
  spawnPosition,
  scoreValue,
  radius,
  onKill,
  children,
  updatePosition,
}: EnemyBaseProps) {
  const meshRef = useRef<THREE.Group>(null)
  const [alive, setAlive] = useState(true)
  const addScore = useGameStore((s) => s.addScore)
  const registerKill = useGameStore((s) => s.registerKill)
  const phase = useGameStore((s) => s.phase)

  const kill = useCallback(() => {
    if (!alive) return
    setAlive(false)
    addScore(scoreValue)
    registerKill()

    const combo = useGameStore.getState().combo
    playExplosionSound(combo.count)

    if (meshRef.current) {
      const pos = meshRef.current.position.clone()
      eventBus.emit('enemy:killed', {
        position: pos,
        combo: combo.count,
        score: Math.round(scoreValue * combo.multiplier),
      })
      onKill(id, pos)
    }
  }, [alive, id, scoreValue, addScore, registerKill, onKill])

  useFrame(({ clock }, delta) => {
    if (!meshRef.current || phase !== 'playing') return

    if (alive) {
      updatePosition(meshRef.current, spawnPosition, clock.elapsedTime, delta)

      // Check bullet collisions
      const pool = getBulletPool()
      if (pool) {
        const liveBullets = pool.getLiveBullets()
        const pos = meshRef.current.position
        for (const bullet of liveBullets) {
          if (bullet.alive) {
            const dist = pos.distanceTo(bullet.position)
            if (dist < radius) {
              bullet.alive = false
              bullet.position.set(0, -9999, 0)
              kill()
              break
            }
          }
        }
      }
    }
  })

  if (!alive) return null

  return (
    <group
      ref={meshRef}
      position={[spawnPosition.x, spawnPosition.y, spawnPosition.z]}
    >
      {children}
    </group>
  )
}
