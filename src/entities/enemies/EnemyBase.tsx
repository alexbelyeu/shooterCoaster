import { useRef, useState, useCallback, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { eventBus } from '@/core/EventBus'
import { gameTime } from '@/core/gameClock'
import { registerCollisionTarget, unregisterCollisionTarget } from '@/combat/CollisionManager'
import type { EnemyType, Formation } from '@/types/level'
import { registerE2EEnemy, unregisterE2EEnemy } from '@/testing/e2eHook'
import { flashMesh, restoreMesh } from './hitFlash'
import { ENEMY_HIT_FLASH_MS, KILL_POP_SCALE, type EnemyKilledEvent } from '@/combat/hitFeedback'
import { entryPoint, type Vec3 } from '@/entities/spawning/spawnPlacement'
import { getExplosionPool } from '@/effects/explosionPoolHandle'
import { DEATH_STYLES } from '@/effects/deathStyles'

export interface EnemyProps {
  id: string
  spawnPosition: THREE.Vector3
  type: EnemyType
  scoreValue: number
  radius: number
  onKill: (id: string) => void
  /** Fly in from `entry.from` to `spawnPosition` first. */
  entry?: EnemyEntry
  /** XZ angle (`atan2(dz, dx)`) a formation moves on together. */
  heading?: number
  formation?: Formation
}

export interface EnemyEntry {
  from: Vec3
  /** Radians the path unwinds around the vertical axis through `from`. */
  spin: number
  seconds: number
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
 * Handles visibility, collision registration, formation entry and death.
 * An entering enemy is not a collision target until it reaches its slot, so touch aim assist never snaps to one still flying in.
 *
 * Death is two-step: on hit the enemy is scored immediately, stops moving and
 * flashes white at 1.2x scale for ENEMY_HIT_FLASH_MS (game time); then it emits
 * 'enemy:killed', plays its type's death effect (`effects/deathStyles.ts`) and unmounts.
 */
export default function EnemyBase({
  id,
  type,
  spawnPosition,
  scoreValue,
  radius,
  onKill,
  entry,
  children,
  updatePosition,
}: EnemyBaseProps) {
  const meshRef = useRef<THREE.Group>(null)
  const [alive, setAlive] = useState(true)
  const aliveRef = useRef(true)
  const addScore = useGameStore((s) => s.addScore)
  const registerKill = useGameStore((s) => s.registerKill)
  const entryT = useRef(entry ? 0 : 1)
  const [entered, setEntered] = useState(!entry)
  // Mount-time only: a re-render (e.g. `entered` flipping) must not move the enemy back.
  const [startPosition] = useState((): [number, number, number] => {
    const p = entry?.from ?? spawnPosition
    return [p.x, p.y, p.z]
  })

  // Kill-pop state: dying between the hit and the explosion.
  const dying = useRef(false)
  const dyingMs = useRef(0)
  const dyingFrames = useRef(0)

  const kill = useCallback(() => {
    if (!aliveRef.current) return
    aliveRef.current = false
    unregisterCollisionTarget(id)
    registerKill()
    addScore(scoreValue)

    dying.current = true
    dyingMs.current = ENEMY_HIT_FLASH_MS
    dyingFrames.current = 0
    const group = meshRef.current
    if (group) {
      group.traverse(flashMesh)
      group.scale.setScalar(KILL_POP_SCALE)
    }
  }, [id, scoreValue, addScore, registerKill])

  /** End of the kill pop: explosion, events, unmount. */
  const finishKill = useCallback(() => {
    dying.current = false
    const combo = useGameStore.getState().combo
    const style = DEATH_STYLES[type]
    const group = meshRef.current
    if (group) {
      group.traverse(restoreMesh)
      const pos = group.position.clone()
      const event: EnemyKilledEvent = {
        position: pos,
        combo: combo.count,
        multiplier: combo.multiplier,
        score: Math.round(scoreValue * combo.multiplier),
        sound: style.sound,
      }
      eventBus.emit('enemy:killed', event)
      getExplosionPool()?.explode(pos, style)
      onKill(id)
    }
    setAlive(false)
  }, [id, type, scoreValue, onKill])

  // Register with CollisionManager
  const deadPos = useRef(new THREE.Vector3(0, -9999, 0)).current
  useEffect(() => {
    if (!entered) return
    const getPosition = () => meshRef.current?.position ?? deadPos
    registerCollisionTarget({
      id,
      getPosition,
      radiusSq: radius * radius,
      onHit: kill,
    })
    return () => unregisterCollisionTarget(id)
  }, [id, radius, kill, entered])

  // Unregister when dead
  useEffect(() => {
    if (!alive) {
      unregisterCollisionTarget(id)
    }
  }, [alive, id])

  // e2e readability probe (no-op unless ?e2e=1)
  useEffect(() => {
    if (!alive || !meshRef.current) return
    registerE2EEnemy(id, type, meshRef.current)
    return () => unregisterE2EEnemy(id)
  }, [alive, id, type])

  useFrame((_, delta) => {
    const { phase, timeScale } = useGameStore.getState()
    if (!meshRef.current || phase !== 'playing') return
    if (timeScale === 0) return

    if (entry && entryT.current < 1) {
      entryT.current = Math.min(1, entryT.current + (delta * timeScale) / entry.seconds)
      entryPoint(meshRef.current.position, entry.from, spawnPosition, entryT.current, entry.spin)
      if (entryT.current === 1) setEntered(true)
    } else if (aliveRef.current) {
      // Game time, not the render clock, so a pause never jumps an orbiting enemy.
      updatePosition(meshRef.current, spawnPosition, gameTime(), delta * timeScale)
    } else if (dying.current) {
      // Frozen in the white pop. The hit may land earlier in this same frame
      // (bullet pool runs first), so require a 2nd tick: the pop is always
      // rendered at least once, even at very low frame rates.
      dyingMs.current -= delta * timeScale * 1000
      dyingFrames.current += 1
      if (dyingMs.current <= 0 && dyingFrames.current >= 2) finishKill()
    }
  })

  if (!alive) return null

  return (
    <group ref={meshRef} position={startPosition}>
      {children}
    </group>
  )
}
