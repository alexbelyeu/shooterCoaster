/**
 * Tone.js throws "Start time must be strictly greater than previous start time"
 * when a source (the oscillator / noise inside a mono Synth or NoiseSynth) is
 * restarted at or before its previous start. That happens when:
 *   - two triggers land in the same JS turn (Tone.now() only advances per
 *     audio render quantum), e.g. two shots in one frame;
 *   - the audio clock falls behind and Tone clamps late Sequence callback times
 *     up to `currentTime`, so consecutive notes get the same start.
 * nextTriggerTime() keeps each node's schedule strictly increasing and never
 * in the past. Pure (no Tone import) so it stays unit-testable; callers pass
 * the context's `currentTime`.
 */
export const MIN_TRIGGER_GAP = 0.001 // seconds

// Keyed by synth object: disposed synths drop out on their own, and a freshly
// created synth starts with no history.
const lastStart = new WeakMap<object, number>()

export function nextTriggerTime(node: object, time: number, currentTime: number): number {
  const prev = lastStart.get(node)
  let t = time > currentTime ? time : currentTime
  if (prev !== undefined && t < prev + MIN_TRIGGER_GAP) t = prev + MIN_TRIGGER_GAP
  lastStart.set(node, t)
  return t
}
