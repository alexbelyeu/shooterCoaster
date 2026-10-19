/**
 * Test hook for automated smoke tests and agent playtests.
 *
 * Only active when the page is loaded with `?e2e=1`. It exposes a small
 * read/write surface on `window.__SC_TEST__` so a headless browser can:
 *   - jump straight into any level (skipping title / level select / audio unlock)
 *   - confirm the render loop is advancing (frame counter)
 *   - read basic renderer stats (draw calls, triangles) as a perf signal
 *   - fire at the nearest on-screen enemy through the real input path and
 *     count fire / hit / kill events (combat feedback screenshots)
 *
 * Keep this file tiny and side-effect free when the flag is off.
 */
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { getAllLevels } from '@/levels/LevelRegistry'
import { eventBus } from '@/core/EventBus'
import { getCollisionTargets, processHit, type CollisionTarget } from '@/combat/CollisionManager'

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
   * Aim the mouse at the nearest on-screen enemy, click (real fire path: bullet,
   * muzzle flash, camera kick) and resolve the hit immediately through the same
   * code the bullet pool uses. Returns the target id, or null if none visible.
   */
  shootNearest: () => string | null
}

// Gameplay camera + canvas, captured by E2EFrameProbe for shootNearest().
let probeCamera: THREE.Camera | null = null
let probeCanvas: HTMLCanvasElement | null = null
const _ndc = new THREE.Vector3()

function shootNearest(): string | null {
  const cam = probeCamera
  const canvas = probeCanvas
  if (!cam || !canvas) return null
  let best: CollisionTarget | null = null
  let bestDist = Infinity
  for (const t of getCollisionTargets().values()) {
    const p = t.getPosition()
    _ndc.copy(p).project(cam)
    if (_ndc.z < -1 || _ndc.z > 1 || Math.abs(_ndc.x) > 0.9 || Math.abs(_ndc.y) > 0.9) continue
    const d = p.distanceToSquared(cam.position)
    if (d < bestDist) {
      bestDist = d
      best = t
    }
  }
  if (!best) return null
  _ndc.copy(best.getPosition()).project(cam)
  const rect = canvas.getBoundingClientRect()
  const clientX = rect.left + ((_ndc.x + 1) / 2) * rect.width
  const clientY = rect.top + ((1 - _ndc.y) / 2) * rect.height
  const init = { clientX, clientY, bubbles: true }
  window.dispatchEvent(new MouseEvent('mousemove', init))
  window.dispatchEvent(new MouseEvent('mousedown', init))
  window.dispatchEvent(new MouseEvent('mouseup', init))
  processHit(best)
  return best.id
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
    errors: [],
    combat: { fired: 0, hits: 0, kills: 0 },
    cameraShake: { current: 0, max: 0 },
    holdFeedback: false,
    shootNearest,
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
  useFrame(({ camera }, delta) => {
    const api = window.__SC_TEST__
    if (!api) return
    probeCamera = camera
    probeCanvas = gl.domElement
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
