import { useRef, useState, useCallback, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { gameTime } from '@/core/gameClock'
import { registerCollisionTarget, unregisterCollisionTarget } from '@/combat/CollisionManager'
import type { EnemyType } from '@/types/level'
import { registerE2EEnemy, unregisterE2EEnemy } from '@/testing/e2eHook'
import { entryPoint, type FormationMotion } from '@/entities/spawning/spawnPlacement'
import type { Vec3 } from '@/utils/vec3'
import type { WallSlot } from '@/entities/spawning/enemyPlacement'
import type { SwimOrbit } from '@/entities/spawning/swimOrbit'
import { DEATH_STYLES, type DeathStyle } from '@/effects/deathStyles'
import { createKillPop, finishKillPop, startKillPop, tickKillPop } from './killPop'
import { hitBystander } from '@/combat/bystanderHit'

export interface EnemyProps {
  id: string
  spawnPosition: THREE.Vector3
  type: EnemyType
  scoreValue: number
  radius: number
  onKill: (id: string) => void
  /** Fly in from `entry.from` to `spawnPosition` first. */
  entry?: EnemyEntry
  /** A formation member's motion after its entry. */
  motion?: FormationMotion
  wall?: WallSlot
  /** A swimmer's circle through `spawnPosition`, placed clear of the world (`spawning/swimOrbit.ts`). */
  orbit?: SwimOrbit
  /** It got away unshot (a climber topped out): gone, unscored. */
  onEscape?: (id: string) => void
  /** Not a target (#518): a hit costs the penalty and the combo (`combat/bystanderHit.ts`), never a kill. */
  bystander?: boolean
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
  ) => void | 'escaped'
  /** Its hit reaction (#463): called once as it is shot, to pose it for the kill pop (an imp throws its arms up). */
  onHit?: () => void
  /** Its burst instead of its type's (a golden balloon pops in gold). */
  deathStyle?: DeathStyle
}

/**
 * Shared base for all enemy types.
 * Handles visibility, collision registration, formation entry and death.
 * An entering enemy is not a collision target until it reaches its slot, so touch aim assist never snaps to one still flying in.
 *
 * Death is the shared kill pop (`killPop.ts`): on hit the enemy is scored immediately, stops moving and
 * flashes white at 1.2x scale for ENEMY_HIT_FLASH_MS (game time); then it emits
 * 'enemy:killed', plays its type's death effect (`effects/deathStyles.ts`) and unmounts.
 * An enemy whose `updatePosition` returns 'escaped' unmounts at once, unscored, through `onEscape`.
 * A bystander is shot like an enemy but puffs out at once through `hitBystander`, with no kill pop.
 */
export default function EnemyBase({
  id,
  type,
  spawnPosition,
  scoreValue,
  radius,
  onKill,
  onEscape,
  bystander = false,
  entry,
  children,
  updatePosition,
  onHit,
  deathStyle = DEATH_STYLES[type],
}: EnemyBaseProps) {
  const meshRef = useRef<THREE.Group>(null)
  const [alive, setAlive] = useState(true)
  const aliveRef = useRef(true)
  const entryT = useRef(entry ? 0 : 1)
  const clockAt = useRef<number | null>(null)
  const [entered, setEntered] = useState(!entry)
  // Mount-time only: a re-render (e.g. `entered` flipping) must not move the enemy back.
  const [startPosition] = useState((): [number, number, number] => {
    const p = entry?.from ?? spawnPosition
    return [p.x, p.y, p.z]
  })

  // Dying between the hit and the explosion.
  const pop = useRef(createKillPop()).current

  const kill = useCallback(() => {
    if (!aliveRef.current) return
    aliveRef.current = false
    unregisterCollisionTarget(id)
    onHit?.()
    startKillPop(pop, meshRef.current, scoreValue)
  }, [id, scoreValue, onHit, pop])

  /** End of the kill pop: explosion, events, unmount. */
  const finishKill = useCallback(() => {
    const group = meshRef.current
    if (group) {
      finishKillPop(pop, group, group.position.clone(), deathStyle)
      onKill(id)
    }
    setAlive(false)
  }, [id, deathStyle, onKill, pop])

  const spare = useCallback(() => {
    if (!aliveRef.current) return
    aliveRef.current = false
    unregisterCollisionTarget(id)
    if (meshRef.current) hitBystander(id, type, meshRef.current.position)
    setAlive(false)
  }, [id, type])

  // Register with CollisionManager
  const deadPos = useRef(new THREE.Vector3(0, -9999, 0)).current
  useEffect(() => {
    if (!entered) return
    const getPosition = () => meshRef.current?.position ?? deadPos
    registerCollisionTarget({
      id,
      getPosition,
      radiusSq: radius * radius,
      onHit: bystander ? spare : kill,
      ...(bystander ? { kind: 'bystander' as const } : {}),
    })
    return () => unregisterCollisionTarget(id)
  }, [id, radius, kill, spare, bystander, entered])

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
    // The fly-in and the motion run on the game clock, the one the waves are timed on (#469: on the frame's own
    // delta, a smoke run stepping level time had its enemies arrive seconds of level time late on a fast runner).
    const now = gameTime()
    const moved = Math.max(0, now - (clockAt.current ?? now))
    clockAt.current = now

    if (entry && entryT.current < 1) {
      entryT.current = Math.min(1, entryT.current + moved / entry.seconds)
      entryPoint(meshRef.current.position, entry.from, spawnPosition, entryT.current, entry.spin)
      if (entryT.current === 1) setEntered(true)
    } else if (aliveRef.current) {
      // Game time, not the render clock, so a pause never jumps an orbiting enemy.
      if (updatePosition(meshRef.current, spawnPosition, now, moved) === 'escaped') {
        aliveRef.current = false
        unregisterCollisionTarget(id)
        setAlive(false)
        onEscape?.(id)
      }
    } else if (tickKillPop(pop, delta * timeScale)) {
      // Frozen in the white pop until it is over.
      finishKill()
    }
  })

  if (!alive) return null

  return (
    <group ref={meshRef} position={startPosition}>
      {children}
    </group>
  )
}
