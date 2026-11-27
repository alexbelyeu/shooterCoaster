import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { eventBus } from '@/core/EventBus'
import { gameClockStep } from '@/core/gameClock'
import { registerCollisionTarget, unregisterCollisionTarget } from '@/combat/CollisionManager'
import { getExplosionPool } from '@/effects/explosionPoolHandle'
import { BOSS_DEFEAT_BURST_OFFSETS, BOSS_PART_DEATH_STYLE, type DeathStyle } from '@/effects/deathStyles'
import { flashMesh, restoreMesh } from '@/entities/enemies/hitFlash'
import { createKillPop, finishKillPop, startKillPop, tickKillPop, type KillPop } from '@/entities/enemies/killPop'
import { e2eBoss, isE2E } from '@/testing/e2eState'
import type { ArcTable } from '@/track/arcLength'
import type { HeightFunction } from '@/utils/terrainNoise'
import {
  applyHit, createBossState, destroyScore, hpFraction, isDefeated, isExposed, setRetracted, weakPointHp,
  type BossSpec, type BossState, type WeakPointSpec,
} from './bossModel'

const BOSS_HIT_FLASH_MS = 60
const _eventAt = new THREE.Vector3()
const _burstAt = new THREE.Vector3()

export interface BossFrame {
  root: THREE.Group
  parts: ReadonlyMap<string, THREE.Group>
  camera: THREE.Camera
  state: BossState
  dt: number
  age: number
  /** -1 while it fights. */
  sinceDefeat: number
  /** Hide a weak point for now or show it again (`BossState.retracted`); its target follows at once. */
  retract: (weakPoint: string, retracted: boolean) => void
}

export interface BossProps {
  id: string
  /** False while dormant: mounted hidden with the level so the shader warm-up covers it. */
  active: boolean
  /** True during its tell (`spec.tell.seconds` before it arrives), while still dormant. */
  incoming: boolean
  onDone: () => void
  track: ArcTable
  /** Terrain as drawn. */
  groundFn: HeightFunction
}

interface BossBaseProps extends Omit<BossProps, 'track' | 'groundFn' | 'incoming'> {
  spec: BossSpec
  move: (frame: BossFrame) => void
  /** Its bounds are the boss's on-screen size (e2e `boss().box`). */
  body: ReactNode
  rigging?: ReactNode
  renderWeakPoint: (weakPoint: WeakPointSpec, exposed: boolean) => ReactNode
  exitSeconds: number
  /** Each destroyed weak point's burst. */
  deathStyle?: DeathStyle
  /** Burst at each of `BOSS_DEFEAT_BURST_OFFSETS` around the body on its defeat (the fair's confetti shower). */
  defeatBurst?: DeathStyle
  /** World space, not moved with the body (e.g. the Yeti's snowballs). */
  children?: ReactNode
}

interface PartFx {
  flashMs: number
  /** A destroyed part's kill pop, the same as an enemy's. */
  pop: KillPop
}

/** `position`s are shared scratch vectors: read them in the listener, don't keep them. */
export interface BossSpawnEvent {
  id: string
  name: string
  /** The body where it arrives (the first frame it is placed). */
  position: THREE.Vector3
}
export interface BossHitEvent {
  id: string
  weakPoint: string
  hpFraction: number
  destroyed: boolean
  /** The weak point hit. */
  position: THREE.Vector3
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
  deathStyle = BOSS_PART_DEATH_STYLE,
  defeatBurst,
  children,
}: BossBaseProps) {
  const camera = useThree((s) => s.camera)
  const rootRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Group>(null)
  const stateRef = useRef(createBossState(spec))
  const [, setPhaseVersion] = useState(0)
  const parts = useRef(new Map<string, THREE.Group>()).current
  const fx = useRef<PartFx[]>(spec.weakPoints.map(() => ({ flashMs: 0, pop: createKillPop() }))).current
  const registered = useRef(new Set<string>()).current
  const clock = useRef({ age: 0, defeatedAt: -1, placed: false, announced: false })
  const frame = useRef({} as BossFrame).current
  const [gameStep] = useState(gameClockStep)
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
        startKillPop(partFx.pop, part, destroyScore(before, after, wpId))
        syncRef.current(after)
        setPhaseVersion((v) => v + 1)
      } else {
        partFx.flashMs = BOSS_HIT_FLASH_MS
        part?.traverse(flashMesh)
      }
      publishHud(after, false)
      const position = part?.getWorldPosition(_eventAt) ?? bodyRef.current?.getWorldPosition(_eventAt) ?? _eventAt
      const event: BossHitEvent = { id, weakPoint: wpId, hpFraction: hpFraction(after), destroyed, position }
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

  const retract = useCallback((wpId: string, retracted: boolean) => {
    const before = stateRef.current
    const after = setRetracted(before, wpId, retracted)
    if (after === before) return
    stateRef.current = after
    syncRef.current(after)
    // A flash in flight would restore the old (exposed) material over the new one.
    const i = spec.weakPoints.findIndex((w) => w.id === wpId)
    if (i >= 0) fx[i].flashMs = 0
    parts.get(wpId)?.traverse(restoreMesh)
    setPhaseVersion((v) => v + 1)
  }, [])

  useEffect(() => {
    if (!active) return
    syncRef.current(stateRef.current)
    publishHud(stateRef.current, false)
    return () => {
      for (const key of registered) unregisterCollisionTarget(key)
      registered.clear()
      useGameStore.getState().setBoss(null)
    }
  }, [active, publishHud, registered])

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
      const { pop } = fx[index]
      if (!part) {
        pop.active = false
        return
      }
      part.visible = false
      pop.active = false
      // The last pop to end defeats it: a part shot just before the final one can still be popping.
      const defeats = isDefeated(stateRef.current) && clock.current.defeatedAt < 0 && !fx.some((f) => f.pop.active)
      finishKillPop(pop, part, part.getWorldPosition(new THREE.Vector3()), deathStyle, defeats ? { bossPart: w.id, big: true } : { bossPart: w.id })
      if (!defeats) return
      clock.current.defeatedAt = clock.current.age
      publishHud(stateRef.current, true)
      if (isE2E) e2eBoss.stage = 'defeated'
      const event: BossDefeatedEvent = { id, position: bodyRef.current?.getWorldPosition(new THREE.Vector3()) ?? part.getWorldPosition(new THREE.Vector3()) }
      eventBus.emit('boss:defeated', event)
      if (defeatBurst) for (const o of BOSS_DEFEAT_BURST_OFFSETS) getExplosionPool()?.explode(_burstAt.copy(event.position).add(o), defeatBurst)
    },
    [id, spec, parts, fx, publishHud, deathStyle, defeatBurst],
  )

  useFrame(() => {
    const root = rootRef.current
    const { phase, timeScale } = useGameStore.getState()
    const c = clock.current
    const testStep = isE2E ? (window.__SC_TEST__?.bossStep ?? null) : null
    // The arrival frame always places it, even with game time frozen.
    if (!root || !active || phase !== 'playing' || (timeScale === 0 && c.placed && testStep === null)) return
    c.placed = true
    // On the game clock, like the waves and the enemies: on the frame's delta a boss moved with the frame rate, not the level.
    const moved = gameStep()
    const dt = testStep ?? moved

    for (let i = 0; i < fx.length; i++) {
      const f = fx[i]
      if (f.pop.active) {
        if (tickKillPop(f.pop, dt)) finishPop(i)
      } else if (f.flashMs > 0) {
        f.flashMs -= dt * 1000
        if (f.flashMs <= 0) parts.get(spec.weakPoints[i].id)?.traverse(restoreMesh)
      }
    }

    const sinceDefeat = c.defeatedAt < 0 ? -1 : c.age - c.defeatedAt
    frame.root = root
    frame.parts = parts
    frame.camera = camera
    frame.state = stateRef.current
    frame.dt = dt
    frame.age = c.age
    frame.sinceDefeat = sinceDefeat
    frame.retract = retract
    move(frame)
    // Announced once placed, so the arrival is heard from where the boss is.
    if (!c.announced) {
      c.announced = true
      // eslint-disable-next-line sc/no-hot-path-alloc -- once per boss, on its arrival frame
      const event: BossSpawnEvent = { id, name: spec.name, position: (bodyRef.current ?? root).getWorldPosition(_eventAt) }
      eventBus.emit('boss:spawn', event)
    }
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
