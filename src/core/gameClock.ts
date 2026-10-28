/** Game-time seconds of the run (`delta × timeScale` on playing frames only), advanced and reset by `combat/comboRuntime.ts`. */
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
