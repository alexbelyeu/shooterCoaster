/**
 * The nightly's gate on shaders compiled after the level's warm-up and the throttled pass's trend file (#539), pure so
 * `slowPass.test.ts` pins them. The smoke measures (`programsAfterWarmup`, `__SC_TEST__.maxFrameMs` / `longFrames`).
 */

const MOMENTS_SHOWN = 6

/** `+N at T s phase (events)` for the first moments a program appeared, and how many more there were. */
export function growthMoments(p) {
  const at = p.moments
    .slice(0, MOMENTS_SHOWN)
    .map((m) => `+${m.added} at ${m.levelTime.toFixed(1)} s ${m.phase}${m.events.length ? ` (${m.events.slice(0, 4).join(', ')})` : ''}`)
  const more = p.moments.length > MOMENTS_SHOWN ? `; ${p.moments.length - MOMENTS_SHOWN} more` : ''
  return at.length ? `[${at.join('; ')}${more}]` : ''
}

/**
 * The problem a gated run (the nightly's throttled pass and `pacing`) adds for a level whose run compiled a shader the
 * warm-up missed, or null. PR shards only report the count.
 */
export function programGateProblem(p) {
  if (!p || p.added <= 0) return null
  return `programs after warm-up: +${p.added}, each a shader ShaderWarmup missed (a hitch on a slow GPU) ${growthMoments(p)}`
}

/** throttle.json: per level of a `--cpu-throttle` run, the ride's longest frame, its frames of 100 ms or more and the programs after warm-up. */
export function throttleReport(rate, results) {
  const levels = {}
  for (const r of results) {
    if (!r.throttled) continue
    levels[r.id] = { maxFrameMs: Math.round(r.throttled.maxMs), longFrames: r.throttled.count, programsAfterWarmup: r.shaders?.added ?? null }
  }
  return { rate, levels }
}
