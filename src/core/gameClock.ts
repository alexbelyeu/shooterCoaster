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

/**
 * A per-frame reader of the game clock: each call returns the game seconds since its previous call (0 on the first).
 * Gameplay motion steps on it, never on the frame's delta, so it keeps pace with the level timer and the waves: a smoke
 * run stepping level time in fixed steps then sees the same motion on any runner (#471).
 */
export function gameClockStep(): () => number {
  let at: number | null = null
  return () => {
    const step = Math.max(0, seconds - (at ?? seconds))
    at = seconds
    return step
  }
}
