import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { eventBus } from '@/core/EventBus'
import { registerCollisionTarget, unregisterCollisionTarget } from '@/combat/CollisionManager'
import { ENEMY_HIT_FLASH_MS, KILL_POP_SCALE } from '@/combat/hitFeedback'
import { playExplosionSound } from '@/audio/SFXManager'
import { getExplosionPool } from '@/effects/explosionPoolHandle'
import { flashMesh, restoreMesh } from '@/entities/enemies/hitFlash'
import { e2eBoss, isE2E } from '@/testing/e2eHook'
import {
  applyHit, createBossState, destroyScore, hpFraction, isDefeated, isExposed, weakPointHp,
  type BossSpec, type BossState, type WeakPointSpec,
} from './bossModel'

const BOSS_HIT_FLASH_MS = 60
const PART_EXPLOSION_COLOR = '#ffd700'

export interface BossFrame {
  root: THREE.Group
  parts: ReadonlyMap<string, THREE.Group>
  camera: THREE.Camera
  state: BossState
  dt: number
  age: number
  /** -1 while it fights. */
  sinceDefeat: number
}

export interface BossProps {
  id: string
  /** False while dormant: mounted hidden with the level so the shader warm-up covers it. */
  active: boolean
  onDone: () => void
}

interface BossBaseProps extends BossProps {
  spec: BossSpec
  move: (frame: BossFrame) => void
  /** Its bounds are the boss's on-screen size (e2e `boss().box`). */
  body: ReactNode
  rigging?: ReactNode
  renderWeakPoint: (weakPoint: WeakPointSpec, exposed: boolean) => ReactNode
  exitSeconds: number
  /** World space, not moved with the body (e.g. confetti). */
  children?: ReactNode
}

interface PartFx {
  flashMs: number
  popMs: number
  popFrames: number
  popping: boolean
  points: number
}

interface BossSpawnEvent {
  id: string
  name: string
}
interface BossHitEvent {
  id: string
  weakPoint: string
  hpFraction: number
  destroyed: boolean
}
export interface BossDefeatedEvent {
  id: string
  position: THREE.Vector3
}

/**
 * One collision target per exposed weak point, re-synced inside the hit (not an effect) so the
 * next hit in the same JS turn already sees the new phase; each destroyed part is a normal kill.
 */
export default function BossBase({
  id,
  active,
  onDone,
  spec,
  move,
  body,
  rigging,
  renderWeakPoint,
  exitSeconds,
  children,
}: BossBaseProps) {
  const camera = useThree((s) => s.camera)
  const rootRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Group>(null)
  const stateRef = useRef(createBossState(spec))
  const [, setPhaseVersion] = useState(0)
  const parts = useRef(new Map<string, THREE.Group>()).current
  const fx = useRef<PartFx[]>(spec.weakPoints.map(() => ({ flashMs: 0, popMs: 0, popFrames: 0, popping: false, points: 0 }))).current
  const registered = useRef(new Set<string>()).current
  const clock = useRef({ age: 0, defeatedAt: -1 })
  const positions = useMemo(() => spec.weakPoints.map(() => new THREE.Vector3()), [spec])

  const targetId = useCallback((wp: string) => `boss:${id}:${wp}`, [id])

  const publishHud = useCallback(
    (state: BossState, defeated: boolean) =>
      useGameStore.getState().setBoss({ name: spec.name, hp: state.hp, maxHp: spec.weakPoints.map((w) => w.hp), defeated }),
    [spec],
  )

  const syncRef = useRef<(state: BossState) => void>(() => {})

  const hit = useCallback(
    (wpId: string) => {
      const before = stateRef.current
      const after = applyHit(before, wpId)
      if (after === before) return
      stateRef.current = after
      const index = spec.weakPoints.findIndex((w) => w.id === wpId)
      const part = parts.get(wpId)
      const partFx = fx[index]
      const destroyed = weakPointHp(after, wpId) <= 0
      if (destroyed) {
        const store = useGameStore.getState()
        partFx.points = destroyScore(before, after, wpId)
        store.registerKill()
        store.addScore(partFx.points)
        partFx.popping = true
        partFx.popMs = ENEMY_HIT_FLASH_MS
        partFx.popFrames = 0
        part?.scale.setScalar(KILL_POP_SCALE)
        syncRef.current(after)
        setPhaseVersion((v) => v + 1)
      } else {
        partFx.flashMs = BOSS_HIT_FLASH_MS
      }
      part?.traverse(flashMesh)
      publishHud(after, false)
      const event: BossHitEvent = { id, weakPoint: wpId, hpFraction: hpFraction(after), destroyed }
      eventBus.emit('boss:hit', event)
    },
    [id, spec, parts, fx, publishHud],
  )

  syncRef.current = (state: BossState) => {
    spec.weakPoints.forEach((w, i) => {
      const key = targetId(w.id)
      const want = isExposed(state, w.id)
      if (want && !registered.has(key)) {
        registered.add(key)
        const position = positions[i]
        registerCollisionTarget({
          id: key,
          getPosition: () => parts.get(w.id)?.getWorldPosition(position) ?? position.set(0, -9999, 0),
          radiusSq: w.radius * w.radius,
          onHit: () => hit(w.id),
        })
      } else if (!want && registered.has(key)) {
        registered.delete(key)
        unregisterCollisionTarget(key)
      }
    })
  }

  useEffect(() => {
    if (!active) return
    syncRef.current(stateRef.current)
    publishHud(stateRef.current, false)
    const event: BossSpawnEvent = { id, name: spec.name }
    eventBus.emit('boss:spawn', event)
    return () => {
      for (const key of registered) unregisterCollisionTarget(key)
      registered.clear()
      useGameStore.getState().setBoss(null)
    }
  }, [active, id, spec, publishHud, registered])

  useEffect(() => {
    if (!isE2E || !bodyRef.current) return
    const handle = { body: bodyRef.current, parts, state: () => stateRef.current }
    e2eBoss.handle = handle
    return () => {
      if (e2eBoss.handle === handle) e2eBoss.handle = null
    }
  }, [parts])

  const finishPop = useCallback(
    (index: number) => {
      const w = spec.weakPoints[index]
      const part = parts.get(w.id)
      const partFx = fx[index]
      partFx.popping = false
      if (!part) return
      part.traverse(restoreMesh)
      part.scale.setScalar(1)
      part.visible = false
      const position = part.getWorldPosition(new THREE.Vector3())
      const { combo } = useGameStore.getState()
      playExplosionSound(combo.count)
      getExplosionPool()?.activate(position, PART_EXPLOSION_COLOR)
      eventBus.emit('enemy:killed', {
        position,
        combo: combo.count,
        multiplier: combo.multiplier,
        score: Math.round(partFx.points * combo.multiplier),
      })
      if (isDefeated(stateRef.current) && clock.current.defeatedAt < 0) {
        clock.current.defeatedAt = clock.current.age
        publishHud(stateRef.current, true)
        if (isE2E) e2eBoss.stage = 'defeated'
        const event: BossDefeatedEvent = { id, position: bodyRef.current?.getWorldPosition(new THREE.Vector3()) ?? position }
        eventBus.emit('boss:defeated', event)
      }
    },
    [id, spec, parts, fx, publishHud],
  )

  useFrame((_, delta) => {
    const root = rootRef.current
    const { phase, timeScale } = useGameStore.getState()
    if (!root || !active || phase !== 'playing' || timeScale === 0) return
    const dt = delta * timeScale
    const c = clock.current

    for (let i = 0; i < fx.length; i++) {
      const f = fx[i]
      if (f.popping) {
        // Like EnemyBase: the pop is rendered at least once, even at very low frame rates.
        f.popMs -= dt * 1000
        f.popFrames += 1
        if (f.popMs <= 0 && f.popFrames >= 2) finishPop(i)
      } else if (f.flashMs > 0) {
        f.flashMs -= dt * 1000
        if (f.flashMs <= 0) parts.get(spec.weakPoints[i].id)?.traverse(restoreMesh)
      }
    }

    const sinceDefeat = c.defeatedAt < 0 ? -1 : c.age - c.defeatedAt
    move({ root, parts, camera, state: stateRef.current, dt, age: c.age, sinceDefeat })
    c.age += dt
    if (sinceDefeat >= exitSeconds) onDone()
  })

  const state = stateRef.current
  return (
    <>
      <group ref={rootRef} visible={active}>
        <group ref={bodyRef}>{body}</group>
        {rigging}
        {spec.weakPoints.map((w) => (
          <group
            key={w.id}
            position={w.offset as [number, number, number]}
            ref={(g) => {
              if (g) parts.set(w.id, g)
              else parts.delete(w.id)
            }}
          >
            {renderWeakPoint(w, isExposed(state, w.id))}
          </group>
        ))}
      </group>
      {children}
    </>
  )
}
