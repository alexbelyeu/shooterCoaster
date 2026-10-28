import { useRef, useState, useCallback, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { playExplosionSound } from '@/audio/SFXManager'
import { eventBus } from '@/core/EventBus'
import { registerCollisionTarget, unregisterCollisionTarget } from '@/combat/CollisionManager'
import type { EnemyType, Formation } from '@/types/level'
import { registerE2EEnemy, unregisterE2EEnemy } from '@/testing/e2eHook'
import { ENEMY_HIT_FLASH_MAT } from './SharedEnemyAssets'
import { ENEMY_HIT_FLASH_MS, KILL_POP_SCALE } from '@/combat/hitFeedback'
import { entryPoint, type Vec3 } from '@/entities/spawning/spawnPlacement'

// Hit flash: swap every mesh under the enemy to the shared flash material and
// back. Module-level callbacks so traverse() allocates nothing.
const ORIGINAL_MATERIAL = '__scOriginalMaterial'
function flashMesh(o: THREE.Object3D) {
  const m = o as THREE.Mesh
  if (!m.isMesh || m.userData[ORIGINAL_MATERIAL] !== undefined) return
  m.userData[ORIGINAL_MATERIAL] = m.material
  m.material = ENEMY_HIT_FLASH_MAT
}
function restoreMesh(o: THREE.Object3D) {
  const m = o as THREE.Mesh
  if (!m.isMesh || m.userData[ORIGINAL_MATERIAL] === undefined) return
  m.material = m.userData[ORIGINAL_MATERIAL] as THREE.Material
  delete m.userData[ORIGINAL_MATERIAL]
}

export interface EnemyProps {
  id: string
  spawnPosition: THREE.Vector3
  type: EnemyType
  scoreValue: number
  radius: number
  onKill: (id: string, position: THREE.Vector3) => void
  /** Formation arrival: fly in from `entry.from` to `spawnPosition` first. */
  entry?: EnemyEntry
  /** Formation members share this XZ heading (`atan2(dz, dx)`) and speed, so the shape holds. */
  heading?: number
  /** The wave's formation, when it has one. */
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
 *
 * With `entry`, the enemy first flies from `entry.from` to its spawn position
 * (game time, like `updatePosition`) and only becomes a collision target once it
 * is in place, so shots and touch aim assist never chase an enemy still arriving.
 *
 * Death is two-step: on hit the enemy is scored immediately, stops moving and
 * flashes white at 1.2x scale for ENEMY_HIT_FLASH_MS (game time); then it emits
 * 'enemy:killed', triggers the explosion via onKill and unmounts.
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
    addScore(scoreValue)
    registerKill()

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
    playExplosionSound(combo.count)

    const group = meshRef.current
    if (group) {
      group.traverse(restoreMesh)
      const pos = group.position.clone()
      eventBus.emit('enemy:killed', {
        position: pos,
        combo: combo.count,
        score: Math.round(scoreValue * combo.multiplier),
      })
      onKill(id, pos)
    }
    setAlive(false)
  }, [id, scoreValue, onKill])

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

  useFrame(({ clock }, delta) => {
    const { phase, timeScale } = useGameStore.getState()
    if (!meshRef.current || phase !== 'playing') return
    if (timeScale === 0) return

    if (entry && entryT.current < 1) {
      entryT.current = Math.min(1, entryT.current + (delta * timeScale) / entry.seconds)
      entryPoint(meshRef.current.position, entry.from, spawnPosition, entryT.current, entry.spin)
      if (entryT.current === 1) setEntered(true)
    } else if (aliveRef.current) {
      updatePosition(meshRef.current, spawnPosition, clock.elapsedTime, delta * timeScale)
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
