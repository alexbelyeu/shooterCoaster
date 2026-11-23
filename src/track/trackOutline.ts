import type { TrackCurve } from './curves/TrackCurve'

/** The current level's track from above for the HUD's radar (#834), published by `LevelScene` so the startup JS carries no track code. */
let outlineLevel: string | null = null
let outline: readonly Float32Array[] = []
const listeners = new Set<() => void>()

/** Samples around the lap: a 3 km lap is a point every ~8 m, finer than the radar's pixel. */
export const OUTLINE_SAMPLES = 400

/** `samples + 1` points, so the lap closes, as flat x, z pairs. */
export function sampleTrackXZ(curve: TrackCurve, samples = OUTLINE_SAMPLES): Float32Array {
  const out = new Float32Array((samples + 1) * 2)
  for (let i = 0; i <= samples; i++) {
    const p = curve.getPointAt(i / samples)
    out[i * 2] = p.x
    out[i * 2 + 1] = p.z
  }
  return out
}

export function setTrackOutline(levelId: string, paths: readonly Float32Array[]): void {
  outlineLevel = levelId
  outline = paths
  for (const listener of listeners) listener()
}

/** The HUD can mount before the lazy scene publishes (the smoke skips the intro). */
export function subscribeTrackOutline(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function trackOutline(levelId: string): readonly Float32Array[] | null {
  return outlineLevel === levelId ? outline : null
}
