import { useEffect, useRef } from 'react'
import { addAfterEffect, useFrame, useThree } from '@react-three/fiber'
import { useGameStore } from '@/store/useGameStore'
import { clearRidePhoto, setRidePhoto, tracePhoto } from '@/store/ridePhoto'
import { distanceAtT, tAtDistance, type ArcTable } from '@/track/arcLength'
import { rideProgress } from '@/track/rideProgress.hot'
import { passedPhoto, photoSize, RIDE_PHOTO_EVENT } from '@/track/photoMarker'
import { eventBus } from '@/core/EventBus'
import type { DevelopRequest, DevelopResult } from './ridePhoto.worker'

/** The JPEG's quality: a souvenir, still small (~100–200 KB at 1280 px). */
const PHOTO_QUALITY = 0.9

/** Keeps the darkroom's JPEG if its run is still on (a run that ended into the next one keeps no photo). */
function developed({ runId, blob, width, height }: DevelopResult) {
  tracePhoto('encoded')
  if (!blob || useGameStore.getState().runId !== runId) return
  setRidePhoto(runId, blob, width, height)
  const testApi = window.__SC_TEST__
  if (testApi) Object.assign(testApi.photo, { width, height, bytes: blob.size })
}

/** A snapshot waiting for the darkroom. */
interface Exposure {
  frame: ImageBitmap
  runId: number
}

/** Hands the snapshot to the darkroom worker to scale and encode (once a run: cold). */
function develop(darkroom: Worker, { frame, runId }: Exposure) {
  const { width, height } = photoSize(frame.width, frame.height)
  const request: DevelopRequest = { runId, frame, width, height, quality: PHOTO_QUALITY }
  darkroom.postMessage(request, [frame])
  tracePhoto('posted')
}

/**
 * Snapshots the frame: called after it has rendered, while the WebGL drawing buffer still holds it (no
 * `preserveDrawingBuffer`). `createImageBitmap` takes the copy now and resolves later; `useFrame` hands it to the
 * darkroom on a later frame, so the scaling and the JPEG never compete with the capture's frame.
 */
function capture(source: HTMLCanvasElement, runId: number, exposed: (e: Exposure) => void) {
  const started = performance.now()
  const frame = createImageBitmap(source)
  const testApi = window.__SC_TEST__
  if (testApi) Object.assign(testApi.photo, { taken: true, progress: rideProgress(), captureMs: performance.now() - started, trace: { start: started } })
  eventBus.emit(RIDE_PHOTO_EVENT)
  // No photo is no loss: the card keeps the postcard.
  frame
    .then((bitmap) => {
      tracePhoto('bitmap')
      exposed({ frame: bitmap, runId })
    })
    .catch(() => {})
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
  /** The frame after the capture: it reports how long the capture's frame took (under e2e) and sends nothing to the darkroom. */
  timing: boolean
}

/** The on-ride photo (#701): the frame the ride passes arc distance `at` in play, once a run, kept for that run only. */
export default function RidePhoto({ table, at }: { table: ArcTable; at: number }) {
  const gl = useThree((s) => s.gl)
  const state = useRef<RideState>({ runId: -1, last: 0, due: false, taken: false, timing: false })
  /** The darkroom worker, for the level's lifetime: started at mount, so the capture's frame never pays for it. */
  const darkroom = useRef<Worker | null>(null)
  const exposure = useRef<Exposure | null>(null)

  useEffect(() => {
    const testApi = window.__SC_TEST__
    if (testApi) testApi.photo.at = tAtDistance(table, at)
  }, [table, at])

  useEffect(() => {
    const worker = new Worker(new URL('./ridePhoto.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<DevelopResult>) => developed(e.data)
    worker.onerror = () => tracePhoto('failed')
    darkroom.current = worker
    return () => {
      darkroom.current = null
      worker.terminate()
      exposure.current?.frame.close()
      exposure.current = null
      clearRidePhoto()
    }
  }, [])

  useFrame((_, delta) => {
    const s = state.current
    if (s.timing) {
      s.timing = false
      const testApi = window.__SC_TEST__
      if (testApi) testApi.photo.frameMs = delta * 1000
      tracePhoto('nextFrame')
    } else if (exposure.current && darkroom.current) {
      // Two frames after the capture at the earliest: the darkroom's readback and encode never run alongside the capture's frame.
      develop(darkroom.current, exposure.current)
      exposure.current = null
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
        s.timing = true
        capture(gl.domElement, s.runId, (e) => {
          // A snapshot that resolves after the level has gone is dropped.
          if (darkroom.current) exposure.current = e
          else e.frame.close()
        })
      }),
    [gl],
  )

  return null
}
