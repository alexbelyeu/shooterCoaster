/**
 * Test hook for automated smoke tests and agent playtests.
 *
 * Only active when the page is loaded with `?e2e=1`. It exposes a small
 * read/write surface on `window.__SC_TEST__` so a headless browser can:
 *   - jump straight into any level (skipping title / level select / audio unlock)
 *   - confirm the render loop is advancing (frame counter)
 *   - read basic renderer stats (draw calls, triangles) as a perf signal
 *
 * Keep this file tiny and side-effect free when the flag is off.
 */
import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { getAllLevels } from '@/levels/LevelRegistry'

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
  /**
   * Deterministic scene totals, independent of camera/frustum culling:
   * every visible mesh's triangles (x instance count) and object count, plus a
   * breakdown for objects with a `name` (e.g. `track`, `track-towers`).
   */
  sceneStats: () => SceneStats | null
}

export interface SceneStats {
  objects: number
  triangles: number
  byName: Record<string, { objects: number; triangles: number }>
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
    sceneStats: () => null,
  }
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
  useFrame((_, delta) => {
    const api = window.__SC_TEST__
    if (!api) return
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
