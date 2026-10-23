/**
 * Trigger times for Tone sources, which throw "Start time must be strictly greater
 * than previous start time" on a restart at the same time: strictly increasing per
 * node, and a late time is pushed LATE_MARGIN past currentTime because the audio
 * clock ticks mid-task and Tone would clamp it to a later time we never record (#115).
 */
export const MIN_TRIGGER_GAP = 0.001 // seconds
export const LATE_MARGIN = 0.02 // seconds: inaudible on a note that is already late

// Weak, so a disposed synth's history goes with it.
const lastStart = new WeakMap<object, number>()

export function nextTriggerTime(node: object, time: number, currentTime: number): number {
  const prev = lastStart.get(node)
  const earliest = currentTime + LATE_MARGIN
  let t = time > earliest ? time : earliest
  if (prev !== undefined && t < prev + MIN_TRIGGER_GAP) t = prev + MIN_TRIGGER_GAP
  lastStart.set(node, t)
  return t
}
