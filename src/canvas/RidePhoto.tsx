import { useEffect, useRef } from 'react'
import { addAfterEffect, useFrame, useThree } from '@react-three/fiber'
import { useGameStore } from '@/store/useGameStore'
import { clearRidePhoto, RIDE_PHOTO_EVENT, setRidePhoto, tracePhoto } from '@/store/ridePhoto'
import { distanceAtT, tAtDistance, type ArcTable } from '@/track/arcLength'
import { rideProgress } from '@/track/rideProgress.hot'
import { passedPhoto, photoSize } from '@/track/photoMarker'
import { eventBus } from '@/core/EventBus'
import { GpuSnapshot } from './gpuSnapshot'
import type { DevelopRequest, DevelopResult } from './ridePhoto.worker'

/** The JPEG's quality: a souvenir, still small (~100–200 KB at 1280 px). */
const PHOTO_QUALITY = 0.9
/** Frames a snapshot may take to come back from the GPU before it is given up (a lost context never answers). */
const READBACK_FRAMES = 300

/** Keeps the darkroom's JPEG if its run is still on (a run that ended into the next one keeps no photo). */
function developed({ runId, blob, width, height }: DevelopResult) {
  tracePhoto('encoded')
  if (!blob || useGameStore.getState().runId !== runId) return
  setRidePhoto(runId, blob, width, height)
  const testApi = window.__SC_TEST__
  if (testApi) Object.assign(testApi.ridePhoto, { width, height, bytes: blob.size })
}

/** Hands the snapshot's pixels to the darkroom worker to encode (once a run: cold). */
function develop(darkroom: Worker, runId: number, { pixels, width, height }: { pixels: Uint8Array; width: number; height: number }) {
  tracePhoto('readback')
  const request: DevelopRequest = { runId, pixels: pixels.buffer as ArrayBuffer, width, height, quality: PHOTO_QUALITY }
  darkroom.postMessage(request, [request.pixels])
  tracePhoto('posted')
}

/** A new run: its photo not taken, the last one dropped. */
function startRun(s: RideState, runId: number, dist: number, snapshot: GpuSnapshot | null) {
  s.runId = runId
  s.taken = false
  s.due = false
  s.timing = false
  s.last = dist
  snapshot?.cancel()
  clearRidePhoto()
  const testApi = window.__SC_TEST__
  if (testApi) Object.assign(testApi.ridePhoto, { taken: false, progress: null, captureMs: null, frameMs: null, beforeMs: null, bytes: null, flashed: false, trace: null })
}

interface RideState {
  runId: number
  /** Arc distance on the last frame. */
  last: number
  /** Passed this frame: captured once it has rendered. */
  due: boolean
  taken: boolean
  /** The frame after the capture: it reports how long the capture's frame took (under e2e) and collects nothing. */
  timing: boolean
  /** Frames the snapshot has been on its way back. */
  waited: number
}

/** The photo's size for the drawing buffer as it is now. */
function snapshotSize(gl: WebGL2RenderingContext) {
  return photoSize(gl.drawingBufferWidth, gl.drawingBufferHeight)
}

/**
 * The on-ride photo (#701): the frame the ride passes arc distance `at` in play, once a run, kept for that run only.
 * The capture is a GPU copy at the photo's size, read back over later frames (`GpuSnapshot`), and the darkroom worker
 * encodes the JPEG, so the capture's frame does no more than queue a blit.
 */
export default function RidePhoto({ table, at }: { table: ArcTable; at: number }) {
  const gl = useThree((s) => s.gl)
  const canvasSize = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const state = useRef<RideState>({ runId: -1, last: 0, due: false, taken: false, timing: false, waited: 0 })
  /** The darkroom worker, for the level's lifetime: started at mount, so the capture's frame never pays for it. */
  const darkroom = useRef<Worker | null>(null)
  const snapshot = useRef<GpuSnapshot | null>(null)

  useEffect(() => {
    const testApi = window.__SC_TEST__
    if (testApi) testApi.ridePhoto.at = tAtDistance(table, at)
  }, [table, at])

  useEffect(() => {
    const worker = new Worker(new URL('./ridePhoto.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<DevelopResult>) => developed(e.data)
    worker.onerror = () => tracePhoto('failed')
    darkroom.current = worker
    snapshot.current = new GpuSnapshot(gl.getContext() as WebGL2RenderingContext)
    return () => {
      darkroom.current = null
      worker.terminate()
      snapshot.current?.dispose()
      snapshot.current = null
      clearRidePhoto()
    }
  }, [gl])

  // The snapshot's buffers at the photo's size before the capture, and again after a resize.
  useEffect(() => {
    const ctx = gl.getContext() as WebGL2RenderingContext
    const { width, height } = snapshotSize(ctx)
    snapshot.current?.size(width, height)
  }, [gl, canvasSize, dpr])

  useFrame((_, delta) => {
    const s = state.current
    const shot = snapshot.current
    if (s.timing) {
      s.timing = false
      const testApi = window.__SC_TEST__
      if (testApi) testApi.ridePhoto.frameMs = delta * 1000
      tracePhoto('nextFrame')
    } else if (shot?.pending) {
      // Two frames after the capture at the earliest, so the readback never shares the capture's frame.
      const back = shot.collect()
      if (back && darkroom.current) develop(darkroom.current, s.runId, back)
      else if (!back && ++s.waited > READBACK_FRAMES) shot.cancel()
    }
    const { runId, phase } = useGameStore.getState()
    const dist = distanceAtT(table, rideProgress())
    if (runId !== s.runId) startRun(s, runId, dist, shot)
    if (!s.taken && phase === 'playing' && passedPhoto(s.last, dist, at, table.length)) {
      s.taken = true
      s.due = true
      if (window.__SC_TEST__) window.__SC_TEST__.ridePhoto.beforeMs = delta * 1000
    }
    s.last = dist
  })

  // After the frame has rendered, while the drawing buffer still holds it (no `preserveDrawingBuffer`).
  useEffect(
    () =>
      addAfterEffect(() => {
        const s = state.current
        const shot = snapshot.current
        if (!s.due || !shot) return
        s.due = false
        s.timing = true
        s.waited = 0
        const started = performance.now()
        const { width, height } = snapshotSize(gl.getContext() as WebGL2RenderingContext)
        // No photo is no loss: the card keeps the postcard.
        shot.take(width, height)
        const testApi = window.__SC_TEST__
        if (testApi) Object.assign(testApi.ridePhoto, { taken: true, progress: rideProgress(), captureMs: performance.now() - started, trace: { start: started } })
        eventBus.emit(RIDE_PHOTO_EVENT)
      }),
    [gl],
  )

  return null
}
