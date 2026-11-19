import { useEffect, useRef } from 'react'
import { addAfterEffect, useFrame, useThree } from '@react-three/fiber'
import { useGameStore } from '@/store/useGameStore'
import { clearRidePhoto, setRidePhoto } from '@/store/ridePhoto'
import { distanceAtT, tAtDistance, type ArcTable } from '@/track/arcLength'
import { rideProgress } from '@/track/rideProgress.hot'
import { passedPhoto, photoSize, RIDE_PHOTO_EVENT } from '@/track/photoMarker'
import { eventBus } from '@/core/EventBus'
import type { DevelopRequest } from './ridePhoto.worker'

/** The JPEG's quality: a souvenir, still small (~100–200 KB at 1280 px). */
const PHOTO_QUALITY = 0.9

/** Under e2e: ms after the capture call `stage` was reached. */
function trace(stage: string) {
  const photo = window.__SC_TEST__?.photo
  if (photo?.trace) photo.trace[stage] = performance.now() - photo.trace.start
}

/** Hands the frame to the darkroom worker to scale and encode, and keeps the JPEG if the run and the level are still on. */
function develop(frame: ImageBitmap, runId: number, mounted: { current: boolean }) {
  trace('bitmap')
  const { width, height } = photoSize(frame.width, frame.height)
  const worker = new Worker(new URL('./ridePhoto.worker.ts', import.meta.url), { type: 'module' })
  const done = (blob: Blob | null) => {
    worker.terminate()
    trace('encoded')
    // A run that ended into the next one, or a level left, before the JPEG was done keeps no photo.
    if (!blob || !mounted.current || useGameStore.getState().runId !== runId) return
    setRidePhoto(runId, blob, width, height)
    const testApi = window.__SC_TEST__
    if (testApi) Object.assign(testApi.photo, { width, height, bytes: blob.size })
  }
  worker.onmessage = (e: MessageEvent<Blob | null>) => done(e.data)
  worker.onerror = () => done(null)
  const request: DevelopRequest = { frame, width, height, quality: PHOTO_QUALITY }
  worker.postMessage(request, [frame])
}

/**
 * Snapshots the frame: called after it has rendered, while the WebGL drawing buffer still holds it (no
 * `preserveDrawingBuffer`). `createImageBitmap` takes the copy now and resolves later, so the scaling and the JPEG
 * stay off the main thread.
 */
function capture(source: HTMLCanvasElement, runId: number, mounted: { current: boolean }) {
  const started = performance.now()
  const frame = createImageBitmap(source)
  const testApi = window.__SC_TEST__
  if (testApi) Object.assign(testApi.photo, { taken: true, progress: rideProgress(), captureMs: performance.now() - started, trace: { start: started } })
  eventBus.emit(RIDE_PHOTO_EVENT)
  // No photo is no loss: the card keeps the postcard.
  frame.then((bitmap) => develop(bitmap, runId, mounted)).catch(() => {})
}

/** A new run: its photo not taken, the last one dropped. */
function startRun(s: RideState, runId: number, dist: number) {
  s.runId = runId
  s.taken = false
  s.due = false
  s.timing = false
  s.last = dist
  clearRidePhoto()
  const testApi = window.__SC_TEST__
  if (testApi) Object.assign(testApi.photo, { taken: false, progress: null, captureMs: null, frameMs: null, beforeMs: null, bytes: null, flashed: false, trace: null })
}

interface RideState {
  runId: number
  /** Arc distance on the last frame. */
  last: number
  /** Passed this frame: captured once it has rendered. */
  due: boolean
  taken: boolean
  /** Under e2e: the frame after the capture reports how long the capture's frame took. */
  timing: boolean
}

/** The on-ride photo (#701): the frame the ride passes arc distance `at` in play, once a run, kept for that run only. */
export default function RidePhoto({ table, at }: { table: ArcTable; at: number }) {
  const gl = useThree((s) => s.gl)
  const state = useRef<RideState>({ runId: -1, last: 0, due: false, taken: false, timing: false })
  const mounted = useRef(true)

  useEffect(() => {
    const testApi = window.__SC_TEST__
    if (testApi) testApi.photo.at = tAtDistance(table, at)
  }, [table, at])

  useFrame((_, delta) => {
    const s = state.current
    if (s.timing) {
      s.timing = false
      const testApi = window.__SC_TEST__
      if (testApi) testApi.photo.frameMs = delta * 1000
      trace('nextFrame')
    }
    const { runId, phase } = useGameStore.getState()
    const dist = distanceAtT(table, rideProgress())
    if (runId !== s.runId) startRun(s, runId, dist)
    if (!s.taken && phase === 'playing' && passedPhoto(s.last, dist, at, table.length)) {
      s.taken = true
      s.due = true
      if (window.__SC_TEST__) window.__SC_TEST__.photo.beforeMs = delta * 1000
    }
    s.last = dist
  })

  useEffect(
    () =>
      addAfterEffect(() => {
        const s = state.current
        if (!s.due) return
        s.due = false
        s.timing = window.__SC_TEST__ !== undefined
        capture(gl.domElement, s.runId, mounted)
      }),
    [gl],
  )
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearRidePhoto()
    }
  }, [])

  return null
}
