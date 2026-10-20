/**
 * Test hook for automated smoke tests and agent playtests.
 *
 * Only active when the page is loaded with `?e2e=1`. It exposes a small
 * read/write surface on `window.__SC_TEST__` so a headless browser can:
 *   - jump straight into any level (skipping title / level select / audio unlock)
 *   - confirm the render loop is advancing (frame counter)
 *   - read basic renderer stats (draw calls, triangles) as a perf signal
 *   - play: autoFire at the nearest visible enemy, killNearest(n) for
 *     deterministic combat screenshots (fires one real shot, then resolves the
 *     hits through the bullet pool's own processHit path), endLevel() to reach
 *     the results screen, stats() for score / kills / combo / shots
 *   - count fire / hit / kill events and camera shake (hit feedback checks)
 *
 * Keep this file tiny and side-effect free when the flag is off: nothing here
 * runs unless `installE2EApi()` finds `?e2e=1`, and <E2EFrameProbe> is only
 * mounted under the same flag.
 */
import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { getAllLevels } from '@/levels/LevelRegistry'
import { eventBus } from '@/core/EventBus'
import { getCollisionTargets, processHit, type CollisionTarget } from '@/combat/CollisionManager'
import { fireAtNDC } from '@/combat/useShooting'

export const isE2E =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('e2e')

export interface SCTestApi {
  frames: number
  /** Rolling average frame time in ms (last ~120 frames). */
  avgFrameMs: number
  drawCalls: number
  triangles: number
  levels: () => { id: string; name: string }[]
  startLevel: (id: string) => void
  phase: () => string
  errors: string[]
  /** Counts of 'weapon:fire' / 'enemy:hit' / 'enemy:killed' since load. */
  combat: { fired: number; hits: number; kills: number }
  /** Camera shake displacement from the track this frame, and the max seen. */
  cameraShake: { current: number; max: number }
  /** Freeze transient feedback (muzzle flash, hitmarker) at its peak for screenshots. */
  holdFeedback: boolean
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
  /** Force the results phase. */
  endLevel: () => void
  setTimeScale: (s: number) => void
}

export interface SceneStats {
  objects: number
  triangles: number
  byName: Record<string, { objects: number; triangles: number }>
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
}

declare global {
  interface Window {
    __SC_TEST__?: SCTestApi
  }
}

const AUTOFIRE_INTERVAL_MS = 100
let autoFireEnabled = false
let lastAutoFire = 0
/** Camera captured by <E2EFrameProbe> so non-React test calls can aim. */
let probeCamera: THREE.Camera | null = null

const _v = new THREE.Vector3()
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
    drawCalls: 0,
    triangles: 0,
    levels: () => getAllLevels().map((l) => ({ id: l.id, name: l.name })),
    startLevel: (id: string) => {
      const s = useGameStore.getState()
      s.resetScore()
      s.resetCombo()
      s.setCurrentLevel(id)
      s.setPhase('playing')
    },
    phase: () => useGameStore.getState().phase,
    errors: [],
    combat: { fired: 0, hits: 0, kills: 0 },
    cameraShake: { current: 0, max: 0 },
    holdFeedback: false,
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
      }
    },
    endLevel: () => {
      autoFireEnabled = false
      useGameStore.getState().setPhase('results')
    },
    setTimeScale: (s: number) => useGameStore.getState().setTimeScale(s),
  }
  eventBus.on('weapon:fire', () => { api.combat.fired += 1 })
  eventBus.on('enemy:hit', () => { api.combat.hits += 1 })
  eventBus.on('enemy:killed', () => { api.combat.kills += 1 })
  window.addEventListener('error', (e) => api.errors.push(String(e.message)))
  window.addEventListener('unhandledrejection', (e) => api.errors.push(String(e.reason)))
  window.__SC_TEST__ = api
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
    if (autoFireEnabled) autoFireTick(state.camera)
    // Post-processing renders several passes per frame, and three.js resets
    // gl.info on every render() call by default. Accumulate manually instead:
    // read last frame's totals, then reset before this frame renders.
    if (gl.info.autoReset) gl.info.autoReset = false
    api.frames += 1
    const ms = delta * 1000
    api.avgFrameMs = api.avgFrameMs === 0 ? ms : api.avgFrameMs + (ms - api.avgFrameMs) / 120
    api.drawCalls = gl.info.render.calls
    api.triangles = gl.info.render.triangles
    gl.info.reset()
  })
  return null
}

function collectSceneStats(scene: THREE.Scene): SceneStats {
  const stats: SceneStats = { objects: 0, triangles: 0, byName: {} }
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
