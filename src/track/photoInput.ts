/**
 * Photo mode's input and save request (#828), between the DOM (`ui/screens/PhotoMode.tsx`, the gamepad poll) and the
 * scene (`PhotoCamera.tsx`), which reads them once a frame. No React, no three.
 */

const input = {
  /** Drag and wheel since the camera last read them: radians, and a radius factor. */
  dYaw: 0,
  dPitch: 0,
  zoom: 1,
  /** The gamepad held now: right stick (-1..1) and zoom (LT out minus RT in, -1..1). */
  padX: 0,
  padY: 0,
  padZoom: 0,
}

export type PhotoInput = typeof input

export function photoTurn(dYaw: number, dPitch: number) {
  input.dYaw += dYaw
  input.dPitch += dPitch
}

export function photoZoom(factor: number) {
  if (factor > 0 && Number.isFinite(factor)) input.zoom *= factor
}

export function photoPad(x: number, y: number, zoom: number) {
  input.padX = x
  input.padY = y
  input.padZoom = zoom
}

/** The input to apply this frame; the accumulated drag and wheel are cleared, the pad's held values stay. */
export function takePhotoInput(out: PhotoInput): PhotoInput {
  Object.assign(out, input)
  input.dYaw = 0
  input.dPitch = 0
  input.zoom = 1
  return out
}

export function resetPhotoInput() {
  photoPad(0, 0, 0)
  input.dYaw = 0
  input.dPitch = 0
  input.zoom = 1
}

let pending: ((png: Blob | null) => void) | null = null

/** Asks the scene for the next composited frame as a PNG; null if it couldn't (photo mode closed first). */
export function requestPhotoCapture(): Promise<Blob | null> {
  pending?.(null)
  return new Promise((resolve) => {
    pending = resolve
  })
}

/** The waiting request, taken (the scene calls `gl.domElement.toBlob` with it right after the frame renders). */
export function takePhotoCapture(): ((png: Blob | null) => void) | null {
  const p = pending
  pending = null
  return p
}
