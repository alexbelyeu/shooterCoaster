import { useRef, useState, useCallback, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { playExplosionSound } from '@/audio/SFXManager'
import { eventBus } from '@/core/EventBus'
import { registerCollisionTarget, unregisterCollisionTarget } from '@/combat/CollisionManager'
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
 * Handles visibility, collision registration, and death.
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
  const aliveRef = useRef(true)
  const addScore = useGameStore((s) => s.addScore)
  const registerKill = useGameStore((s) => s.registerKill)
  const phase = useGameStore((s) => s.phase)

  const kill = useCallback(() => {
    if (!aliveRef.current) return
    aliveRef.current = false
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
  }, [id, scoreValue, addScore, registerKill, onKill])

  // Register with CollisionManager
  const deadPos = useRef(new THREE.Vector3(0, -9999, 0)).current
  useEffect(() => {
    const getPosition = () => meshRef.current?.position ?? deadPos
    registerCollisionTarget({
      id,
      getPosition,
      radiusSq: radius * radius,
      onHit: kill,
    })
    return () => unregisterCollisionTarget(id)
  }, [id, radius, kill])

  // Unregister when dead
  useEffect(() => {
    if (!alive) {
      unregisterCollisionTarget(id)
    }
  }, [alive, id])

  useFrame(({ clock }, delta) => {
    if (!meshRef.current || phase !== 'playing') return
    const timeScale = useGameStore.getState().timeScale
    if (timeScale === 0) return

    if (aliveRef.current) {
      updatePosition(meshRef.current, spawnPosition, clock.elapsedTime, delta * timeScale)
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
