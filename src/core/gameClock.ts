/**
 * Game-time seconds of the current run: advanced by `delta × timeScale` on playing frames
 * (`combat/comboRuntime.ts`, from `GameTimer`), so it stands still while paused and in the
 * countdown, and runs slow in slow-mo. Reset when a run starts.
 */
let seconds = 0

export function gameTime(): number {
  return seconds
}

export function advanceGameTime(dt: number): void {
  if (dt > 0) seconds += dt
}

export function resetGameTime(): void {
  seconds = 0
}
