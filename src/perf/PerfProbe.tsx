import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { recordFrame, type FrameSample } from '@/core/hitchLog'
import { useGameStore } from '@/store/useGameStore'
import { isE2E } from '@/testing/e2eHook'
import { rendererName } from '@/telemetry/playerTelemetry'
import { frameTime, hitchLog, noteContextLoss, perfContext } from './perfRecorder'

/** Chrome's non-standard heap size; Safari and Firefox have none. */
type MemoryPerformance = Performance & { memory?: { usedJSHeapSize: number } }

const sample: FrameSample = { t: 0, frameMs: 0, phase: '', level: null, programs: 0, geometries: 0, textures: 0, drawCalls: 0, heap: null, rafMs: 0, renderMs: 0, timerMs: 0 }

/** First of the frame's `useFrame` callbacks: what it takes from `frameTime` is the whole previous frame's. */
const FIRST = -1000

/**
 * `?perf=1` (#536): samples every frame into the hitch log: its length, the programs, geometries and
 * textures the renderer gained, the draw calls (0 = a blank frame), and the time since the last frame spent in
 * animation-frame callbacks, `renderer.render` and timers (#596).
 */
export default function PerfProbe() {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    perfContext.gl = gl
    perfContext.gpu = rendererName(gl.getContext())
    // Draw calls summed over the frame's passes, as E2EFrameProbe does; under ?e2e=1 that probe resets them.
    if (!isE2E) gl.info.autoReset = false
    const canvas = gl.domElement
    const lost = () => noteContextLoss(true)
    const restored = () => noteContextLoss(false)
    canvas.addEventListener('webglcontextlost', lost)
    canvas.addEventListener('webglcontextrestored', restored)
    const render = gl.render
    gl.render = (scene, camera) => {
      const start = performance.now()
      render.call(gl, scene, camera)
      frameTime.render += performance.now() - start
    }
    return () => {
      gl.render = render
      perfContext.gl = null
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('webglcontextrestored', restored)
    }
  }, [gl])

  useFrame((state, delta) => {
    const { phase, currentLevel } = useGameStore.getState()
    sample.t = performance.now()
    sample.frameMs = delta * 1000
    sample.phase = phase
    sample.level = currentLevel
    sample.programs = gl.info.programs?.length ?? 0
    sample.geometries = gl.info.memory.geometries
    sample.textures = gl.info.memory.textures
    sample.drawCalls = isE2E ? (window.__SC_TEST__?.drawCalls ?? 1) : gl.info.render.calls
    sample.heap = (performance as MemoryPerformance).memory?.usedJSHeapSize ?? null
    sample.rafMs = frameTime.raf
    sample.renderMs = frameTime.render
    sample.timerMs = frameTime.timers
    frameTime.raf = frameTime.render = frameTime.timers = 0
    if (!isE2E) gl.info.reset()
    perfContext.dpr = state.viewport.dpr
    recordFrame(hitchLog, sample)
  }, FIRST)
  return null
}
