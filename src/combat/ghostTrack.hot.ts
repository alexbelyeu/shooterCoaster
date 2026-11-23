/**
 * Ghost replay (#844): the aim and shots of a run on a fixed game-time timeline, recorded while the level plays and
 * sampled back on the next run of that level. Game time (`core/gameClock.ts`), not wall time, so a pause or the
 * slow-mo can't desync it. Per-frame code only: the storage codec is `ghost.ts`.
 */

/** Seconds of game time between samples while recording. */
export const GHOST_STEP_S = 0.05
/** Samples kept: past it the timeline halves its rate (`decimateGhost`), it is never cut short. 120 s at 20 Hz. */
export const GHOST_MAX_SAMPLES = 2400
/** Aim is stored as 10 bits per axis over the viewport. */
export const GHOST_AXIS_MAX = 1023

export interface GhostTrack {
  /** Seconds between samples. */
  step: number
  /** Samples in use (the arrays may be longer). */
  count: number
  /** Aim, `0..GHOST_AXIS_MAX` of the viewport's width / height. */
  x: Uint16Array
  y: Uint16Array
  /** 1 where a shot left the gun during the sample's step. */
  shot: Uint8Array
}

export interface GhostPoint {
  /** Aim at the sampled time, 0..1 of the viewport. */
  x: number
  y: number
  /** The sample the time falls in. */
  index: number
}

/**
 * Halves the timeline in place: every other sample is kept, a dropped sample's shot folds into the one before it,
 * and the step doubles.
 */
export function decimateGhost(track: GhostTrack): void {
  const { x, y, shot } = track
  const half = Math.ceil(track.count / 2)
  for (let i = 0; i < half; i++) {
    x[i] = x[2 * i]
    y[i] = y[2 * i]
    shot[i] = shot[2 * i] | (2 * i + 1 < track.count ? shot[2 * i + 1] : 0)
  }
  track.count = half
  track.step *= 2
}

/** The aim at game time `t`, between the two samples around it; held at the first and last sample outside the track. */
export function sampleGhost(track: GhostTrack, t: number, out: GhostPoint): void {
  const f = Math.min(track.count - 1, Math.max(0, t / track.step))
  const i = Math.floor(f)
  const j = Math.min(track.count - 1, i + 1)
  out.x = (track.x[i] + (track.x[j] - track.x[i]) * (f - i)) / GHOST_AXIS_MAX
  out.y = (track.y[i] + (track.y[j] - track.y[i]) * (f - i)) / GHOST_AXIS_MAX
  out.index = i
}

/** The run recorded so far (`saveGhost` stores it on a new best). */
export const recording: GhostTrack = {
  step: GHOST_STEP_S,
  count: 0,
  x: new Uint16Array(GHOST_MAX_SAMPLES),
  y: new Uint16Array(GHOST_MAX_SAMPLES),
  shot: new Uint8Array(GHOST_MAX_SAMPLES),
}
let shotsSeen = 0

/** A run starts: the recording starts over. */
export function resetGhostRecording(): void {
  recording.step = GHOST_STEP_S
  recording.count = 0
  shotsSeen = 0
}

/**
 * One playing frame at game time `t`: the aim (0..1 of the viewport) fills every sample due by `t`, and a rise in the
 * run's shot count marks the sample the frame falls in.
 */
export function recordGhost(t: number, nx: number, ny: number, shots: number): void {
  while (recording.count * recording.step <= t) {
    if (recording.count === GHOST_MAX_SAMPLES) decimateGhost(recording)
    const i = recording.count++
    recording.x[i] = Math.round(Math.min(1, Math.max(0, nx)) * GHOST_AXIS_MAX)
    recording.y[i] = Math.round(Math.min(1, Math.max(0, ny)) * GHOST_AXIS_MAX)
    recording.shot[i] = 0
  }
  if (shots > shotsSeen && recording.count) recording.shot[recording.count - 1] = 1
  shotsSeen = shots
}
