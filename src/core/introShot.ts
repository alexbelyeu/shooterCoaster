/**
 * What the intro (#674, `ui/hud/Intro.tsx`) and the camera's tour (#328, #675, `track/introCamera.hot.ts`) tell each other:
 * when the intro started, and whether the camera is off the seat (the gun stays hidden then).
 */

/** The intro's length (#674), the same on every device: the tour (#675) runs on the wall clock, not on frames. */
export const INTRO_SECONDS = 10

let startedAt: number | null = null
let offSeat = false

/** `performance.now()` time the intro started; null outside it. */
export function setIntroStartedAt(at: number | null): void {
  startedAt = at
}

export function introStartedAt(): number | null {
  return startedAt
}

export function setCameraOffSeat(off: boolean): void {
  offSeat = off
}

/** The camera is touring the level or orbiting the landmark, not riding. */
export function cameraOffSeat(): boolean {
  return offSeat
}
