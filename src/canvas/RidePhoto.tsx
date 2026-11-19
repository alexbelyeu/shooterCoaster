import { useEffect, useRef } from 'react'
import { addAfterEffect, useFrame, useThree } from '@react-three/fiber'
import { useGameStore } from '@/store/useGameStore'
import { clearRidePhoto, setRidePhoto } from '@/store/ridePhoto'
import { distanceAtT, tAtDistance, type ArcTable } from '@/track/arcLength'
import { rideProgress } from '@/track/rideProgress.hot'
import { passedPhoto, photoSize, RIDE_PHOTO_EVENT } from '@/track/photoMarker'
import { eventBus } from '@/core/EventBus'

/** The JPEG's quality: a souvenir, still small (~100–200 KB at 1280 px). */
const PHOTO_QUALITY = 0.9

/** Scales the frame down into a 2D canvas and encodes it, a task after the capture. */
async function develop(frame: ImageBitmap, runId: number, mounted: { current: boolean }) {
  const { width, height } = photoSize(frame.width, frame.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.drawImage(frame, 0, 0, width, height)
  frame.close()
  const blob = ctx ? await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY)) : null
  canvas.width = 0
  canvas.height = 0
  // A run that ended into the next one, or a level left, before the JPEG was done keeps no photo.
  if (!blob || !mounted.current || useGameStore.getState().runId !== runId) return
  setRidePhoto(runId, blob, width, height)
  const testApi = window.__SC_TEST__
  if (testApi) Object.assign(testApi.photo, { width, height, bytes: blob.size })
}

/**
 * Snapshots the frame: called after it has rendered, while the WebGL drawing buffer still holds it (no
 * `preserveDrawingBuffer`). `createImageBitmap` takes the copy now and resolves later, so the scaling and the JPEG
 * stay off the frame.
 */
function capture(source: HTMLCanvasElement, runId: number, mounted: { current: boolean }) {
  const started = performance.now()
  const frame = createImageBitmap(source)
  const testApi = window.__SC_TEST__
  if (testApi) Object.assign(testApi.photo, { taken: true, progress: rideProgress(), captureMs: performance.now() - started })
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
  if (testApi) Object.assign(testApi.photo, { taken: false, progress: null, captureMs: null, frameMs: null, beforeMs: null, bytes: null })
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
