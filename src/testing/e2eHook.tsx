/**
 * Test hook for automated smoke tests and agent playtests.
 *
 * Only active when the page is loaded with `?e2e=1`. It exposes a small
 * read/write surface on `window.__SC_TEST__` so a headless browser can:
 *   - jump straight into any level (skipping title / level select / audio unlock)
 *   - confirm the render loop is advancing (frame counter)
 *   - read basic renderer stats (draw calls, triangles) as a perf signal
 *   - list on-screen enemies with their projected size (readability checks)
 *   - freeze game time so a screenshot matches a query (setTimeScale)
 *   - play: autoFire at the nearest visible enemy, killNearest(n) for
 *     deterministic combat screenshots (fires one real shot, then resolves the
 *     hits through the bullet pool's own processHit path), endLevel() to reach
 *     the results screen, stats() for score / kills / combo (tier, frenzy slow-mo) / shots / hits,
 *     primeCombo(n) to set up a long chain,
 *     enemyScreenPoints(n) to drive real pointer / touch input at enemies
 *   - count fire / hit / kill events, camera translation / trauma rotation and
 *     the weapon view-model's on-screen box (hit feedback checks)
 *   - read audio state (live SFX node count, slow-mo music duck, music crossfade buses) and render it offline
 *   - read the camera pose (title fly-by), shader program count and longest frame (first-shot hitch)
 *   - summon the level's boss now, read it (hp, exposed weak points, on-screen box) and hit it through processHit
 *
 * Keep this file tiny and side-effect free when the flag is off: nothing here
 * runs unless `installE2EApi()` finds `?e2e=1`, and <E2EFrameProbe> is only
 * mounted under the same flag.
 */
import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import * as Tone from 'tone'
import { useGameStore } from '@/store/useGameStore'
import { getAllLevels } from '@/levels/LevelRegistry'
import { eventBus } from '@/core/EventBus'
import { ENEMY_SILHOUETTE, projectedPx } from '@/entities/enemies/enemyReadability'
import type { EnemyType } from '@/types/level'
import type { GamePhase, ScoreEntry } from '@/types/game'
import { getCollisionTargets, processHit, type CollisionTarget } from '@/combat/CollisionManager'
import { fireAtNDC } from '@/combat/useShooting'
import { hashString } from '@/utils/rng'
import { gameTime } from '@/core/gameClock'
import { comboMultiplier } from '@/combat/comboTiers'
import { frenzyActive } from '@/combat/comboRuntime'
import { getPointerState } from '@/input/pointerInput'
import { initAudio, isAudioReady, isMusicDucked } from '@/audio/AudioEngine'
import { playExplosionSound, playFireSound, playHitTick, playWaveStinger, sfxNodeCount } from '@/audio/SFXManager'
import { droppedSounds } from '@/audio/soundGuard'
import { nextTriggerTime } from '@/audio/triggerTime'
import { musicState, type MusicFade } from '@/audio/musicBus'
import type { AudioRenderRequest, AudioRenderResult } from './audioRender'
import { exposedWeakPoints, hpFraction, weakPointHp, type BossState } from '@/entities/bosses/bossModel'

export const isE2E =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('e2e')

export interface SCTestApi {
  frames: number
  /** Rolling average frame time in ms (last ~120 frames). */
  avgFrameMs: number
  /** Longest frame in ms since a test last set this to 0 (first-shot hitch check). */
  maxFrameMs: number
  /** Shader programs the renderer has compiled so far (a rise mid-play is a compile hitch). */
  programs: () => number
  /** Active camera's world position and unit view direction (title fly-by check). */
  cameraPose: () => { position: [number, number, number]; forward: [number, number, number] } | null
  drawCalls: number
  triangles: number
  levels: () => { id: string; name: string }[]
  /** Start a level; `seed` pins the run seed (enemy spawns), else `?seed=` or a fresh one. */
  startLevel: (id: string, seed?: number) => void
  /** `<count>:<hash>` of the latest run's spawn positions (formation members: their seeded slots); null until a spawner has generated them. */
  spawnDigest: () => string | null
  /** Every `wave:incoming` (the tell, ~1 s early) and `wave:announce` (arrival) since load, with performance.now() ms. */
  waveEvents: { kind: 'incoming' | 'announce'; label: string; ms: number }[]
  phase: () => string
  /** Jump to a UI phase (e.g. `levelSelect`) without clicking through the screens before it. */
  setPhase: (phase: GamePhase) => void
  /** Replace the saved best scores / stars (persisted to localStorage like real saves). */
  setSavedScores: (scores: Record<string, ScoreEntry>) => void
  /**
   * Enemies whose centre is inside the view frustum, largest first, with screen
   * position (CSS px, origin top-left) and projected silhouette size in px.
   * Occlusion by terrain is not considered.
   */
  enemies: () => E2EEnemyOnScreen[]
  errors: string[]
  /** Counts of 'weapon:fire' / 'enemy:hit' / 'enemy:killed' since load. */
  combat: { fired: number; hits: number; kills: number }
  /** Camera translation off the track pose this frame, and the max seen.
   *  Feedback is rotation-only (issue #65), so this must stay exactly 0. */
  cameraTranslation: { current: number; max: number }
  /** Kill / world-event trauma camera rotation this frame and the max seen (largest of
   *  pitch / yaw / roll, degrees). Kill trauma decays to 0 within 250 ms. */
  cameraTrauma: { current: number; max: number }
  /** Coaster camera weight (#123) applied this frame and the max seen since load:
   *  bank and pitch (degrees, signed; maxima are absolute), the speed + drop FOV widening,
   *  the smoothed ride speed (0–1) and the wind-streak opacity (#27). */
  cameraWeight: {
    roll: number; pitch: number; fovKick: number; maxRoll: number; maxPitch: number; maxFovKick: number
    speed: number; streaks: number; maxStreaks: number
  }
  /** First-person weapon view-model on screen (CSS px, origin top-left):
   *  bounding box of its projected bounds and the muzzle tip. null before the
   *  first level frame. */
  weapon: E2EWeaponOnScreen | null
  /** Freeze transient feedback (muzzle flash, hitmarker) at its peak for screenshots. */
  holdFeedback: boolean
  /** Seconds every live bullet flies per frame instead of the frame time, and no bullet expires;
   *  0 freezes them (e.g. a fresh one at the muzzle), null is normal play. */
  bulletStep: number | null
  /** Drawn bullets (#165): count, largest screen radius (fraction of canvas height) now and since load, newest one's CSS px point. */
  bullets: () => E2EBullets
  /** Fire one real shot through NDC (x, y), like a click there. False if not fired (phase, fire delay). */
  fireShot: (x: number, y: number) => boolean
  /**
   * Deterministic scene totals, independent of camera/frustum culling:
   * every visible mesh's triangles (x instance count) and object count, plus a
   * breakdown for objects with a `name` (e.g. `track`, `track-towers`).
   */
  sceneStats: () => SceneStats | null
  /** Every 100 ms (real time, at most once per rendered frame) aim at the nearest
   *  live on-screen enemy and fire a real bullet through the pool. */
  autoFire: (enabled: boolean) => void
  /** Kill the n nearest live enemies (on-screen ones first). Fires one real shot
   *  at the first on-screen victim (bullet, muzzle flash, camera kick; may be
   *  throttled by the fire delay), then resolves each victim through
   *  processHit — the bullet pool's own hit path (enemy:hit, hit flash, kill pop;
   *  enemy:killed follows ~80 ms later). Returns how many were hit. */
  killNearest: (n: number) => number
  stats: () => SCTestStats
  /** Viewport (CSS px) positions of up to n live on-screen enemies, nearest
   *  first, so a test can tap / click real input at them. */
  enemyScreenPoints: (n: number) => { x: number; y: number }[]
  /** Set the live combo chain to `count` kills, the last one now (game time), so the next kill extends it. */
  primeCombo: (count: number) => void
  /** Force the results phase. */
  endLevel: () => void
  /** Set game time scale (0 freezes camera + enemies, 1 resumes). */
  setTimeScale: (s: number) => void
  /** Set to a track fraction (0–1) to jump the coaster there on its next frame. */
  rideTo: number | null
  /** Set to a speed (0–1 between the level's min and max velocity) to put the coaster at it on its next frame. */
  rideSpeed: number | null
  // ── View / aspect (issue #66) ──
  /** Active camera projection vs the canvas's on-screen box (squash checks). */
  view: () => E2EView | null
  /** Audio state: unlocked yet, live gameplay SFX nodes (must stay flat while
   *  shooting / killing, 0 after level exit), music low-pass ducked (slow-mo). */
  audio: () => E2EAudio
  /** Tone scheduling stress (#115), in one JS turn while the audio clock ticks: rapid
   *  shots + layered kills + a stinger, then 10 pairs of late music-loop notes
   *  (`lateScheduleErrors` counts their throws). Unlocks audio if needed. */
  audioBurst: (shots: number, kills: number) => Promise<E2EAudio & { lateScheduleErrors: number }>
  /** Whether pointer input has the trigger held (released on blur / tab hide). */
  triggerHeld: () => boolean
  /** Offline render of the game's own music / SFX code (`npm run audio:render`, `testing/audioRender.ts`).
   *  Only on the title screen before audio unlocks: Tone's global context is offline while it runs. */
  renderAudio: (req: AudioRenderRequest, seed?: number) => Promise<AudioRenderResult>
  /** The current level's shader warm-up (`canvas/ShaderWarmup.tsx`): finished?, how long it took
   *  from level mount, and the renderer's program count after it. null before the first level. */
  shaderWarmup: { done: boolean; ms: number; programs: number } | null
  // ── Boss (issue #181) ──
  /** Bring the level's boss in now (tell, then arrival on the next frames) instead of at its level time. */
  summonBoss: () => void
  /** The level's boss: stage, hp, exposed weak points on screen, the body's on-screen box. */
  boss: () => E2EBoss
  /** n hits on the boss's exposed weak points (nearest first), each through processHit. Returns how many landed. */
  bossHit: (n: number) => number
  /** Counts of 'boss:spawn' / 'boss:hit' / 'boss:defeated' since load. */
  bossEvents: { spawn: number; hit: number; defeated: number }
  // ── Combo-streak fireworks (issue #182) ──
  /** The level's firework pool (theme park only): mounted?, launches / bursts since mount, live now, the newest burst on screen. */
  fireworks: () => E2EFireworks
}

export interface E2EFireworks {
  mounted: boolean
  launched: number
  bursts: number
  rocketsLive: number
  burstsLive: number
  /** Newest burst's centre in CSS px, onScreen = inside the canvas and in front of the camera. */
  lastBurst: { x: number; y: number; onScreen: boolean } | null
}

export type E2EBossStage = 'none' | 'waiting' | 'incoming' | 'active' | 'defeated' | 'done'

export interface E2EBoss {
  stage: E2EBossStage
  hpFraction: number | null
  weakPointsLeft: number
  /** Exposed weak points: id, hp left, CSS px (origin top-left), NDC, and whether inside the viewport. */
  exposed: { id: string; hp: number; x: number; y: number; ndcX: number; ndcY: number; onScreen: boolean }[]
  /** Projected bounds of the body (CSS px) and its width / height as fractions of the canvas. */
  box: { minX: number; minY: number; maxX: number; maxY: number; widthFrac: number; heightFrac: number } | null
}

export interface E2EAudio {
  ready: boolean
  sfxNodes: number
  musicDucked: boolean
  /** Sounds dropped by a caught audio error since load (must stay 0). */
  dropped: number
  lastDrop: string | null
  /** Music buses still connected (`audio/musicBus.ts`) with their gain now, and the last few gain ramps. */
  music: { buses: { name: string; gain: number; fading: boolean }[]; fades: MusicFade[] }
}

export interface E2EView {
  /** `camera.aspect` of the active (gameplay) camera; null if not perspective. */
  cameraAspect: number | null
  /** Width / height of the canvas element as laid out on screen (CSS px). */
  canvasAspect: number
  canvasWidth: number
  canvasHeight: number
  /** Drawing-buffer size in device pixels and the renderer's pixel ratio. */
  bufferWidth: number
  bufferHeight: number
  dpr: number
  /** Vertical and horizontal field of view in degrees. */
  fov: number | null
  hFov: number | null
}

export interface SceneStats {
  objects: number
  triangles: number
  byName: Record<string, { objects: number; triangles: number }>
  /** scene.environment (the baked sky env map), or null when none is set */
  environment: { name: string; intensity: number; bakeMs: number | null } | null
}

export interface SCTestStats {
  score: number
  kills: number
  combo: number
  timeRemaining: number
  phase: string
  liveEnemies: number
  /** Live enemies in front of the camera and inside the viewport (not occlusion-tested). */
  onScreenEnemies: number
  shotsFired: number
  hits: number
  bestCombo: number
  /** Current combo tier multiplier (1, 2, 3, 5). */
  multiplier: number
  timeScale: number
  /** The top-tier slow-mo owns timeScale. */
  frenzy: boolean
  runSeed: number
  currentLevel: string | null
}

export interface E2EBullets {
  drawn: number
  screenFrac: number
  maxScreenFrac: number
  newest: { x: number; y: number } | null
}

export interface E2EWeaponOnScreen {
  visible: boolean
  minX: number
  minY: number
  maxX: number
  maxY: number
  tipX: number
  tipY: number
  /** Gun pivot (receiver centre) on screen: pivot → tip is the barrel's direction. */
  pivotX: number
  pivotY: number
  /** Aim point of the last shot (where the tracer ends). */
  shotX: number
  shotY: number
  /** Viewport the box was measured in. */
  width: number
  height: number
}

export interface E2EEnemyOnScreen {
  id: string
  type: string
  x: number
  y: number
  px: number
  distance: number
}

/** Live enemy objects, registered by EnemyBase only when the e2e flag is on. */
const enemyRegistry = new Map<string, { type: EnemyType | 'goldenBalloon'; object: THREE.Object3D }>()
export function registerE2EEnemy(id: string, type: EnemyType | 'goldenBalloon', object: THREE.Object3D) {
  if (isE2E) enemyRegistry.set(id, { type, object })
}
export function unregisterE2EEnemy(id: string) {
  if (isE2E) enemyRegistry.delete(id)
}

/** Hash of the current run's spawn positions (all waves + golden balloons), set by EnemySpawner. */
let spawnDigest: string | null = null
export function recordE2ESpawns(positions: readonly { x: number; y: number; z: number }[]) {
  if (!isE2E) return
  const text = positions.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`).join(';')
  spawnDigest = `${positions.length}:${hashString(text).toString(16)}`
}

/** Camera + viewport captured by <E2EFrameProbe> so non-React test calls can aim/project. */
let probeCamera: THREE.Camera | null = null
let probeSize = { width: 1280, height: 720 }
const _v = new THREE.Vector3()
const _w = new THREE.Vector3()

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

function readFireworks(): E2EFireworks {
  const f = e2eFireworks
  let lastBurst: E2EFireworks['lastBurst'] = null
  if (f.hasLast && probeCamera) {
    _v.copy(f.last).project(probeCamera)
    const onScreen = _v.z < 1 && Math.abs(_v.x) <= 1 && Math.abs(_v.y) <= 1
    lastBurst = { x: ((_v.x + 1) / 2) * probeSize.width, y: ((1 - _v.y) / 2) * probeSize.height, onScreen }
  }
  const { mounted, launched, bursts, rocketsLive, burstsLive } = f
  return { mounted, launched, bursts, rocketsLive, burstsLive, lastBurst }
}

function readBullets(): E2EBullets {
  const b = e2eBullets
  let newest: E2EBullets['newest'] = null
  if (b.hasNewest && probeCamera) {
    _v.copy(b.newest).project(probeCamera)
    if (_v.z < 1) newest = { x: ((_v.x + 1) / 2) * probeSize.width, y: ((1 - _v.y) / 2) * probeSize.height }
  }
  return { drawn: b.drawn, screenFrac: b.screenFrac, maxScreenFrac: b.maxScreenFrac, newest }
}

/** Written by BossSpawner / BossBase when the e2e flag is on; read through `boss()`. */
export const e2eBoss: {
  summon: boolean
  stage: E2EBossStage
  handle: { body: THREE.Object3D; parts: ReadonlyMap<string, THREE.Object3D>; state: () => BossState } | null
} = { summon: false, stage: 'none', handle: null }

const _box = new THREE.Box3()
const _corner = new THREE.Vector3()

function readBoss(): E2EBoss {
  const h = e2eBoss.handle
  const out: E2EBoss = { stage: e2eBoss.stage, hpFraction: null, weakPointsLeft: 0, exposed: [], box: null }
  if (!h) return out
  const state = h.state()
  out.hpFraction = hpFraction(state)
  out.weakPointsLeft = state.hp.filter((hp) => hp > 0).length
  const cam = probeCamera
  if (!cam) return out
  const { width, height } = probeSize
  for (const w of exposedWeakPoints(state)) {
    const part = h.parts.get(w.id)
    if (!part) continue
    part.getWorldPosition(_v).project(cam)
    out.exposed.push({
      id: w.id,
      hp: weakPointHp(state, w.id),
      x: ((_v.x + 1) / 2) * width,
      y: ((1 - _v.y) / 2) * height,
      ndcX: _v.x,
      ndcY: _v.y,
      onScreen: _v.z < 1 && Math.abs(_v.x) <= 1 && Math.abs(_v.y) <= 1,
    })
  }
  _box.setFromObject(h.body)
  if (_box.isEmpty()) return out
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < 8; i++) {
    _corner.set(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z).project(cam)
    if (_corner.z > 1) continue
    const x = Math.min(Math.max(((_corner.x + 1) / 2) * width, 0), width)
    const y = Math.min(Math.max(((1 - _corner.y) / 2) * height, 0), height)
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  if (minX < maxX) out.box = { minX, minY, maxX, maxY, widthFrac: (maxX - minX) / width, heightFrac: (maxY - minY) / height }
  return out
}

function bossHit(n: number): number {
  let landed = 0
  for (let i = 0; i < n; i++) {
    let best: CollisionTarget | null = null
    let bestD = Infinity
    for (const t of getCollisionTargets().values()) {
      if (!t.id.startsWith('boss:')) continue
      const d = probeCamera ? t.getPosition().distanceToSquared(probeCamera.position) : 0
      if (d < bestD) {
        bestD = d
        best = t
      }
    }
    if (!best) break
    processHit(best)
    landed++
  }
  return landed
}

function enemiesOnScreen(): E2EEnemyOnScreen[] {
  const cam = probeCamera
  if (!cam) return []
  const fov = cam instanceof THREE.PerspectiveCamera ? cam.fov : 80
  const out: E2EEnemyOnScreen[] = []
  cam.getWorldPosition(_w)
  for (const [id, { type, object }] of enemyRegistry) {
    object.getWorldPosition(_v)
    const distance = _v.distanceTo(_w)
    _v.project(cam)
    if (_v.z > 1 || Math.abs(_v.x) > 1 || Math.abs(_v.y) > 1) continue
    out.push({
      id,
      type,
      x: ((_v.x + 1) / 2) * probeSize.width,
      y: ((1 - _v.y) / 2) * probeSize.height,
      px: projectedPx(ENEMY_SILHOUETTE[type] ?? 50, distance, probeSize.height, fov),
      distance,
    })
  }
  return out.sort((a, b) => b.px - a.px)
}

declare global {
  interface Window {
    __SC_TEST__?: SCTestApi
  }
}

const AUTOFIRE_INTERVAL_MS = 100
let autoFireEnabled = false
let lastAutoFire = 0
const _fwd = new THREE.Vector3()

function isLive(t: CollisionTarget) {
  // Dead/unmounted enemies report a parking position far below the world.
  return t.getPosition().y > -9000
}

/** NDC of a target if it is in front of the camera and inside the viewport. */
function onScreenNDC(t: CollisionTarget, camera: THREE.Camera, out: THREE.Vector3): boolean {
  camera.getWorldDirection(_fwd)
  _v.copy(t.getPosition()).sub(camera.position)
  if (_v.dot(_fwd) <= 0) return false
  out.copy(t.getPosition()).project(camera)
  return out.z < 1 && Math.abs(out.x) <= 1 && Math.abs(out.y) <= 1
}

function liveTargetsByDistance(camera: THREE.Camera | null) {
  const list: { t: CollisionTarget; d: number; visible: boolean }[] = []
  const ndc = new THREE.Vector3()
  for (const t of getCollisionTargets().values()) {
    if (!isLive(t)) continue
    const d = camera ? t.getPosition().distanceToSquared(camera.position) : 0
    const visible = camera ? onScreenNDC(t, camera, ndc) : false
    list.push({ t, d, visible })
  }
  // On-screen first, then nearest.
  list.sort((a, b) => Number(b.visible) - Number(a.visible) || a.d - b.d)
  return list
}

const _aim = new THREE.Vector3()
function autoFireTick(camera: THREE.Camera) {
  const now = performance.now()
  if (now - lastAutoFire < AUTOFIRE_INTERVAL_MS) return
  if (useGameStore.getState().phase !== 'playing') return
  let best: CollisionTarget | null = null
  let bestD = Infinity
  for (const t of getCollisionTargets().values()) {
    if (!isLive(t) || !onScreenNDC(t, camera, _aim)) continue
    const d = t.getPosition().distanceToSquared(camera.position)
    if (d < bestD) {
      bestD = d
      best = t
    }
  }
  if (!best) return
  onScreenNDC(best, camera, _aim)
  if (fireAtNDC(_aim.x, _aim.y, camera)) lastAutoFire = now
}

export function installE2EApi() {
  if (!isE2E || window.__SC_TEST__) return
  const api: SCTestApi = {
    frames: 0,
    avgFrameMs: 0,
    maxFrameMs: 0,
    programs: () => probeGl?.info.programs?.length ?? 0,
    cameraPose: readCameraPose,
    drawCalls: 0,
    triangles: 0,
    levels: () => getAllLevels().map((l) => ({ id: l.id, name: l.name })),
    startLevel: (id: string, seed?: number) => useGameStore.getState().startRun(id, seed),
    setPhase: (phase: GamePhase) => useGameStore.getState().setPhase(phase),
    setSavedScores: (scores: Record<string, ScoreEntry>) => useGameStore.setState({ savedScores: scores }),
    spawnDigest: () => spawnDigest,
    waveEvents: [],
    audio: readAudio,
    audioBurst,
    renderAudio: (req, seed) => import('./audioRender').then((m) => m.renderAudio(req, seed)),
    phase: () => useGameStore.getState().phase,
    enemies: enemiesOnScreen,
    errors: [],
    combat: { fired: 0, hits: 0, kills: 0 },
    cameraTranslation: { current: 0, max: 0 },
    cameraTrauma: { current: 0, max: 0 },
    cameraWeight: { roll: 0, pitch: 0, fovKick: 0, maxRoll: 0, maxPitch: 0, maxFovKick: 0, speed: 0, streaks: 0, maxStreaks: 0 },
    weapon: null,
    holdFeedback: false,
    bulletStep: null,
    bullets: readBullets,
    fireShot: (x: number, y: number) => (probeCamera ? fireAtNDC(x, y, probeCamera) : false),
    shaderWarmup: null,
    sceneStats: () => null,
    autoFire: (enabled: boolean) => {
      autoFireEnabled = enabled
      lastAutoFire = 0
    },
    killNearest: (n: number) => {
      const victims = liveTargetsByDistance(probeCamera).slice(0, Math.max(0, n))
      const first = victims[0]
      if (first?.visible && probeCamera && onScreenNDC(first.t, probeCamera, _aim)) {
        fireAtNDC(_aim.x, _aim.y, probeCamera)
      }
      for (const { t } of victims) processHit(t)
      return victims.length
    },
    stats: () => {
      const s = useGameStore.getState()
      let liveEnemies = 0
      let onScreenEnemies = 0
      for (const t of getCollisionTargets().values()) {
        if (!isLive(t)) continue
        liveEnemies++
        if (probeCamera && onScreenNDC(t, probeCamera, _aim)) onScreenEnemies++
      }
      return {
        score: Math.round(s.score),
        kills: s.kills,
        combo: s.combo.count,
        timeRemaining: s.timeRemaining,
        phase: s.phase,
        liveEnemies,
        onScreenEnemies,
        shotsFired: s.shotsFired,
        hits: s.hits,
        bestCombo: s.bestCombo,
        multiplier: s.combo.multiplier,
        timeScale: s.timeScale,
        frenzy: frenzyActive(),
        runSeed: s.runSeed,
        currentLevel: s.currentLevel,
      }
    },
    enemyScreenPoints: (n: number) => {
      if (!probeCamera) return []
      const out: { x: number; y: number }[] = []
      const ndc = new THREE.Vector3()
      for (const { t, visible } of liveTargetsByDistance(probeCamera)) {
        if (!visible || out.length >= n) break
        onScreenNDC(t, probeCamera, ndc)
        out.push({
          x: ((ndc.x + 1) / 2) * window.innerWidth,
          y: ((1 - ndc.y) / 2) * window.innerHeight,
        })
      }
      return out
    },
    primeCombo: (count: number) =>
      useGameStore.setState({ combo: { count, multiplier: comboMultiplier(count), lastKillTime: gameTime() } }),
    endLevel: () => {
      autoFireEnabled = false
      useGameStore.getState().setPhase('results')
    },
    setTimeScale: (s: number) => useGameStore.getState().setTimeScale(s),
    rideTo: null,
    rideSpeed: null,
    view: readView,
    triggerHeld: () => getPointerState().down,
    summonBoss: () => { e2eBoss.summon = true },
    boss: readBoss,
    bossHit,
    bossEvents: { spawn: 0, hit: 0, defeated: 0 },
    fireworks: readFireworks,
  }
  eventBus.on('boss:spawn', () => { api.bossEvents.spawn += 1 })
  eventBus.on('boss:hit', () => { api.bossEvents.hit += 1 })
  eventBus.on('boss:defeated', () => { api.bossEvents.defeated += 1 })
  eventBus.on('weapon:fire', () => { api.combat.fired += 1 })
  eventBus.on('enemy:hit', () => { api.combat.hits += 1 })
  eventBus.on('enemy:killed', () => { api.combat.kills += 1 })
  eventBus.on('wave:incoming', (label) => { api.waveEvents.push({ kind: 'incoming', label: String(label), ms: performance.now() }) })
  eventBus.on('wave:announce', (label) => { api.waveEvents.push({ kind: 'announce', label: String(label), ms: performance.now() }) })
  window.addEventListener('error', (e) => api.errors.push(String(e.error?.stack ?? e.message)))
  window.addEventListener('unhandledrejection', (e) => api.errors.push(String(e.reason)))
  window.__SC_TEST__ = api
}

/** Spin (max 20 ms) until AudioContext.currentTime moves, which it does mid-task. */
function waitForAudioTick() {
  const ctx = Tone.getContext()
  const t0 = ctx.currentTime
  const deadline = performance.now() + 20
  while (ctx.currentTime === t0 && performance.now() < deadline) { /* spin */ }
}

async function audioBurst(shots: number, kills: number) {
  if (!isAudioReady()) await initAudio()
  for (let i = 0; i < shots; i++) {
    playFireSound(i % 2 === 1)
    if (i < kills) {
      playHitTick()
      playExplosionSound(kills - i)
    }
    waitForAudioTick()
  }
  playWaveStinger()

  // Tone clamps the first late note to the ticked clock; before #115 the second landed on it.
  // A fresh synth per pair: only a start from silence records a new start time.
  const ctx = Tone.getContext()
  let lateScheduleErrors = 0
  for (let pair = 0; pair < 10; pair++) {
    const synth = new Tone.Synth({ envelope: { attack: 0.03, decay: 0.2, sustain: 0.25, release: 0.3 } })
    for (let i = 0; i < 2; i++) {
      const now = ctx.currentTime
      const t = nextTriggerTime(synth, now - 0.5, now)
      if (i === 0) waitForAudioTick()
      try {
        synth.triggerAttackRelease('C3', 0.2, t)
      } catch {
        lateScheduleErrors++
      }
    }
    synth.dispose()
  }
  return { ...readAudio(), lateScheduleErrors }
}

function readAudio(): E2EAudio {
  const d = droppedSounds()
  return {
    ready: isAudioReady(),
    sfxNodes: sfxNodeCount(),
    musicDucked: isMusicDucked(),
    dropped: d.count,
    lastDrop: d.last,
    music: isAudioReady() ? musicState() : { buses: [], fades: [] },
  }
}

const _poseDir = new THREE.Vector3()
const _posePos = new THREE.Vector3()

function readCameraPose() {
  const cam = probeCamera
  if (!cam) return null
  cam.getWorldDirection(_poseDir)
  const p = cam.getWorldPosition(_posePos)
  return { position: [p.x, p.y, p.z] as [number, number, number], forward: [_poseDir.x, _poseDir.y, _poseDir.z] as [number, number, number] }
}

/** Canvas element captured by <E2EFrameProbe> for view(). */
let probeCanvas: HTMLCanvasElement | null = null
let probeGl: THREE.WebGLRenderer | null = null
let probeDpr = 1

function readView(): E2EView | null {
  const cam = probeCamera
  const canvas = probeCanvas
  if (!cam || !canvas) return null
  const r = canvas.getBoundingClientRect()
  const persp = cam instanceof THREE.PerspectiveCamera ? cam : null
  const hFov = persp
    ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(persp.fov) / 2) * persp.aspect))
    : null
  return {
    cameraAspect: persp ? persp.aspect : null,
    canvasAspect: r.height > 0 ? r.width / r.height : 0,
    canvasWidth: r.width,
    canvasHeight: r.height,
    bufferWidth: canvas.width,
    bufferHeight: canvas.height,
    dpr: probeDpr,
    fov: persp ? persp.fov : null,
    hFov,
  }
}

/** Mount inside <Canvas>. Counts frames and samples renderer stats. */
export function E2EFrameProbe() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const api = window.__SC_TEST__
    if (api) api.sceneStats = () => collectSceneStats(scene)
  }, [scene])
  useFrame((state, delta) => {
    const api = window.__SC_TEST__
    if (!api) return
    probeCamera = state.camera
    probeSize = state.size
    probeCanvas = state.gl.domElement
    probeGl = state.gl
    probeDpr = state.viewport.dpr
    if (autoFireEnabled) autoFireTick(state.camera)
    // Post-processing renders several passes per frame, and three.js resets
    // gl.info on every render() call by default. Accumulate manually instead:
    // read last frame's totals, then reset before this frame renders.
    if (gl.info.autoReset) gl.info.autoReset = false
    api.frames += 1
    const ms = delta * 1000
    api.avgFrameMs = api.avgFrameMs === 0 ? ms : api.avgFrameMs + (ms - api.avgFrameMs) / 120
    if (ms > api.maxFrameMs) api.maxFrameMs = ms
    api.drawCalls = gl.info.render.calls
    api.triangles = gl.info.render.triangles
    gl.info.reset()
  })
  return null
}

function collectSceneStats(scene: THREE.Scene): SceneStats {
  const env = scene.environment
  const stats: SceneStats = {
    objects: 0,
    triangles: 0,
    byName: {},
    environment: env
      ? { name: env.name, intensity: scene.environmentIntensity, bakeMs: (env.userData.bakeMs as number | undefined) ?? null }
      : null,
  }
  scene.traverseVisible((o) => {
    const m = o as THREE.Mesh & { isInstancedMesh?: boolean; count?: number }
    if (!m.isMesh || !m.geometry) return
    const g = m.geometry
    const verts = g.index ? g.index.count : (g.attributes.position?.count ?? 0)
    const tris = Math.floor(verts / 3) * (m.isInstancedMesh ? (m.count ?? 1) : 1)
    stats.objects += 1
    stats.triangles += tris
    if (m.name) {
      const key = m.name
      const e = (stats.byName[key] ??= { objects: 0, triangles: 0 })
      e.objects += 1
      e.triangles += tris
    }
  })
  return stats
}
