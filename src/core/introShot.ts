/**
 * What the countdown and the camera's intro swoop (#328, `track/introCamera.hot.ts`) tell each other: when GO is due,
 * and whether the camera is off the seat (the gun stays hidden then).
 */

let goAt: number | null = null
let offSeat = false

/** `performance.now()` time GO is due, from the countdown's Set; null when not known. */
export function setCountdownGoAt(at: number | null): void {
  goAt = at
}

export function countdownGoAt(): number | null {
  return goAt
}

export function setCameraOffSeat(off: boolean): void {
  offSeat = off
}

/** The camera is swooping in or orbiting the landmark, not riding. */
export function cameraOffSeat(): boolean {
  return offSeat
}
