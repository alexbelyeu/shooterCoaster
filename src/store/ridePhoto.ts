import { useSyncExternalStore } from 'react'

/** The run's on-ride photo (#701): a JPEG in memory for that run only, never uploaded or stored. */
export interface RidePhoto {
  runId: number
  blob: Blob
  /** An object URL for the results print, revoked when the photo is dropped. */
  url: string
  width: number
  height: number
}

/** Bus event on the frame after the photo is taken (the capture's frame does only its blit): the HUD's flash and the shutter sound. Here, not in `track/photoMarker.ts`,
 *  so the HUD's flash keeps the ride's physics out of the startup JS. */
export const RIDE_PHOTO_EVENT = 'ride:photo'

let photo: RidePhoto | null = null
const listeners = new Set<() => void>()

function publish(next: RidePhoto | null) {
  if (photo) URL.revokeObjectURL(photo.url)
  photo = next
  for (const l of listeners) l()
}

export function setRidePhoto(runId: number, blob: Blob, width: number, height: number): void {
  publish({ runId, blob, url: URL.createObjectURL(blob), width, height })
}

export function clearRidePhoto(): void {
  if (photo) publish(null)
}

/** The photo taken on run `runId`, or null. */
export function ridePhotoFor(runId: number): RidePhoto | null {
  return photo?.runId === runId ? photo : null
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useRidePhoto(runId: number): RidePhoto | null {
  return useSyncExternalStore(subscribe, () => ridePhotoFor(runId))
}

/** Under e2e: records the ms after the capture call that `stage` of the photo was reached (the smoke prints them on a slow capture frame). */
export function tracePhoto(stage: string): void {
  const trace = window.__SC_TEST__?.ridePhoto.trace
  if (trace) trace[stage] = performance.now() - trace.start
}
