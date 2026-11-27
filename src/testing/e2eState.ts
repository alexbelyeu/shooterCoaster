/**
 * The e2e flag and the counters the game writes for the test hook (`e2eHook.tsx`), in the startup JS.
 *
 * Game modules import from here, never from `e2eHook.tsx`: the hook itself (`window.__SC_TEST__`, its readers, the
 * frame probe) is a lazy chunk `main.tsx` loads only under `?e2e=1` (#1113), so players never download it. Every
 * writer here is a no-op, or a field nobody reads, when the flag is off.
 */
import * as THREE from 'three'
import type { EnemyType, RideBeat } from '@/types/level'
import type { LivePickup } from '@/combat/pickups/Pickups'
import type { Junction, SwitchPose } from '@/track/mechanics'
import type { TrackCurve } from '@/track/curves/TrackCurve'
import type { BossState } from '@/entities/bosses/bossModel'
import { hashString } from '@/utils/rng'
import type { SCTestApi } from './e2eHook'

declare global {
  interface Window {
    __SC_TEST__?: SCTestApi
  }
}

export const isE2E =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('e2e')

export type E2EBossStage = 'none' | 'waiting' | 'incoming' | 'active' | 'defeated' | 'done'


/** Live enemy objects, registered by EnemyBase only when the e2e flag is on. */
export const enemyRegistry = new Map<string, { type: EnemyType | 'goldenBalloon'; object: THREE.Object3D }>()
export function registerE2EEnemy(id: string, type: EnemyType | 'goldenBalloon', object: THREE.Object3D) {
  if (!isE2E) return
  enemyRegistry.set(id, { type, object })
  if (countsInTally(id)) runTally.spawned.add(id)
}

/**
 * The run's enemies (#1058 `killShare`): each that came into play, and each the model player (`autoFire`'s player mode)
 * killed. Golden balloons (outside `maxScore`), bystanders and the boss's weak points are left out. `basePoints`: every kill's
 * points before the combo multiplier (weak points and goldens in), the score `maxScore` is the kill-everything total of. Reset by
 * `startLevel` and `restartLevel`.
 */
export const runTally = { spawned: new Set<string>(), killed: new Set<string>(), escaped: new Set<string>(), basePoints: 0 }
export const countsInTally = (id: string) => !id.startsWith('bystander-') && !isBossId(id) && enemyRegistry.get(id)?.type !== 'goldenBalloon'
export function resetRunTally() {
  runTally.spawned.clear()
  runTally.killed.clear()
  runTally.escaped.clear()
  runTally.basePoints = 0
}

/** An enemy gone unscored (`onEscape`: one that slipped away, a climber topped out): off the kill count's total (#1059). */
export function recordE2EEscape(id: string) {
  if (isE2E) runTally.escaped.add(id)
}
export function unregisterE2EEnemy(id: string) {
  if (isE2E) enemyRegistry.delete(id)
}

/** Hash of the current run's spawn positions (all waves + golden balloons), set by EnemySpawner. */
export let spawnDigest: string | null = null
export function recordE2ESpawns(positions: readonly { x: number; y: number; z: number }[]) {
  if (!isE2E) return
  const text = positions.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`).join(';')
  spawnDigest = `${positions.length}:${hashString(text).toString(16)}`
}

/** The level timer's elapsed seconds, reported by GameTimer every playing frame (for `stopAtLevelTime`). */
export let e2eLevelTime = 0
export function noteE2ELevelTime(seconds: number) {
  if (isE2E) e2eLevelTime = seconds
}
/** This frame's step under `stopAtLevelTime`, worked out once: the timer and the ride read the same one whichever runs first. */
const stopStep = { frame: NaN, delta: NaN, step: 0 }
// A hair past the stop, so the timer's remaining seconds round down to the stop's whole second.
const STOP_EPSILON = 1e-6

/** Level time for a playing frame of `delta` seconds: the frame time, unless a test set `timerStep` / `timerStepMax` / `stopAtLevelTime`. */
export function levelTimeStep(delta: number): number {
  const api = isE2E ? window.__SC_TEST__ : undefined
  const step = api?.timerStep ?? (api?.timerStepMax != null ? Math.min(delta, api.timerStepMax) : delta)
  if (api?.stopAtLevelTime == null) return step
  // The animation frame's timestamp is the same for every useFrame callback of one frame.
  const frame = Number(document.timeline.currentTime)
  if (frame !== stopStep.frame || delta !== stopStep.delta) {
    const left = api.stopAtLevelTime - e2eLevelTime
    stopStep.frame = frame
    stopStep.delta = delta
    stopStep.step = left <= 0 ? 0 : Math.min(step, left + STOP_EPSILON)
  }
  return stopStep.step
}

/** True while a test holds the level timer (`holdLevelTime`); never in normal play. */
export function levelTimeHeld(): boolean {
  return isE2E && window.__SC_TEST__?.holdLevelTime === true
}

/** Seconds the coaster rides on a playing frame of `delta` seconds when a test set `rideRate`, else null. */
export function e2eRideSeconds(delta: number): number | null {
  const rate = isE2E ? window.__SC_TEST__?.rideRate : null
  return rate == null ? null : levelTimeStep(delta) * rate
}

/** Idle ms before the title's attract mode: `idleMs` in the game, the test's `titleAttractIdleMs` under e2e (null: never). */
export function e2eAttractIdleMs(idleMs: number): number | null {
  return isE2E ? (window.__SC_TEST__?.titleAttractIdleMs ?? null) : idleMs
}

/** The title camera's time when a test holds it (`titleTime`), else null. */
export function e2eTitleTime(): number | null {
  return isE2E ? (window.__SC_TEST__?.titleTime ?? null) : null
}

/** The mounted spawner's wave schedule, set by EnemySpawner. */
export interface WaveProbe {
  levelTime: number
  due: number | null
  lastTick: number | null
}
export let waveProbe: (() => WaveProbe) | null = null
export function registerE2EWaves(probe: typeof waveProbe) {
  if (isE2E) waveProbe = probe
}

/** Written by BulletPool every playing frame when the e2e flag is on; read through `bullets()`. */
export const e2eBullets = {
  drawn: 0,
  screenFrac: 0,
  maxScreenFrac: 0,
  hasNewest: false,
  newest: new THREE.Vector3(),
}

/** Written by `effects/Fireworks.tsx` when the e2e flag is on; read through `fireworks()`. */
export const e2eFireworks = {
  mounted: false,
  launched: 0,
  bursts: 0,
  rocketsLive: 0,
  burstsLive: 0,
  hasLast: false,
  last: new THREE.Vector3(),
}

/** Written by `shared/ParticleField.tsx` when the e2e flag is on; read through `particles()`. */
export const e2eParticles = { mounted: false, points: 0, boostPoints: 0, boost: 0 }

/** Written by `canvas/LevelScene.tsx` when the e2e flag is on: the running level's v2 ride beats (its ride is in its world's chunk, #960); read through `rideBeats()`. */
export const e2eRide: { beats: readonly RideBeat[] } = { beats: [] }

/** Written by `combat/pickups/Pickups.tsx` when the e2e flag is on; read through `pickups()`. */
export const e2ePickups: { list: readonly LivePickup[] } = { list: [] }

/** Written by `track/TrackSwitch.tsx` when the e2e flag is on; read through `trackSwitch()`. */
export const e2eSwitch: {
  state: { pose: SwitchPose; main: TrackCurve; junction: Junction; open: () => boolean } | null
} = { state: null }

/** Written by `effects/ParticleExplosion.tsx` when the e2e flag is on; read through `deaths()`. */
export const e2eDeaths = {
  mounted: false,
  spawned: 0,
  live: 0,
  lastStyle: '',
  hasLast: false,
  last: new THREE.Vector3(),
}

/** Written by BossSpawner / BossBase when the e2e flag is on; read through `boss()`. */
export const e2eBoss: {
  /** The run `summonBoss()` was called in, until that run's BossSpawner takes it. */
  summon: number | null
  stage: E2EBossStage
  handle: { body: THREE.Object3D; parts: ReadonlyMap<string, THREE.Object3D>; state: () => BossState } | null
  /** World positions of its live projectiles, set by a boss that throws them. */
  projectiles: (() => readonly THREE.Vector3[]) | null
} = { summon: null, stage: 'none', handle: null, projectiles: null }

export const isBossId = (id: string) => id.startsWith('boss:')

/** Target id prefix of a boss's projectiles: not `boss:`, so `bossHit` leaves them and they are shot like enemies. */
export const BOSS_PROJECTILE_PREFIX = 'boss-projectile:'
