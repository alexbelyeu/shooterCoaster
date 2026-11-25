/**
 * When `rideToLevelTime` gives up on a ride (#1032). The deadline counts from the ride's last progress, not its start:
 * a fixed 40 s from the start cut a slow runner's ride (2.2 s a frame, still riding) at 9.3 s of its 10, and the enemy
 * probe at that early moment reported "no enemies on screen". Progress is level time advancing, or, once the level timer
 * is at the target, frames rendering (the ride then waits only for `minFrames`). Before the level registers its waves
 * (`levelTime` null) the load gets `loadMs` on top. A page whose level time stops while frames render (a step that
 * never settles) still goes overdue.
 */
export function createRideDeadline({ target, deadlineMs, loadMs, now }) {
  let last = { key: null, at: now }
  return {
    /** Feed the latest poll; true once the ride has made no progress for its deadline. */
    overdue({ levelTime, frames }, t) {
      const key = levelTime == null ? 'load' : levelTime >= target ? `frames ${frames}` : `time ${levelTime}`
      if (key !== last.key) last = { key, at: t }
      return t - last.at >= deadlineMs + (levelTime == null ? loadMs : 0)
    },
  }
}
