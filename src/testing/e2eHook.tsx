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
 *
 * Keep this file tiny and side-effect free when the flag is off.
 */
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { getAllLevels } from '@/levels/LevelRegistry'
import { ENEMY_SILHOUETTE, projectedPx } from '@/entities/enemies/enemyReadability'
import type { EnemyType } from '@/types/level'

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
  /** Set game time scale (0 freezes camera + enemies, 1 resumes). */
  setTimeScale: (scale: number) => void
  /**
   * Enemies whose centre is inside the view frustum, largest first, with screen
   * position (CSS px, origin top-left) and projected silhouette size in px.
   * Occlusion by terrain is not considered.
   */
  enemies: () => E2EEnemyOnScreen[]
  errors: string[]
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

let probeCamera: THREE.Camera | null = null
let probeSize = { width: 1280, height: 720 }
const _v = new THREE.Vector3()
const _w = new THREE.Vector3()

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
    setTimeScale: (scale: number) => useGameStore.getState().setTimeScale(scale),
    enemies: enemiesOnScreen,
    errors: [],
  }
  window.addEventListener('error', (e) => api.errors.push(String(e.message)))
  window.addEventListener('unhandledrejection', (e) => api.errors.push(String(e.reason)))
  window.__SC_TEST__ = api
}

/** Mount inside <Canvas>. Counts frames and samples renderer stats. */
export function E2EFrameProbe() {
  const gl = useThree((s) => s.gl)
  useFrame(({ camera, size }, delta) => {
    const api = window.__SC_TEST__
    if (!api) return
    probeCamera = camera
    probeSize = size
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
