/**
 * Startup phases as `performance.mark`s (`sc:<phase>`), each placed once per page load: the first
 * time it happens. `startupTimings()` reads them back as ms from navigation (`__SC_TEST__.initTimings()`,
 * printed by the smoke's countdown step); in DevTools they show on the Performance timeline.
 */
export const STARTUP_PHASES = [
  /** main.tsx ran (bundle loaded and evaluated). */
  'boot',
  /** The title scene's first frame. */
  'titleFrame',
  /** The title screen mounted: PLAY takes clicks from here (it fades in over the next 1.3 s). */
  'playReady',
  /** The first `startRun`. */
  'runStart',
  /** The first level's scene mounted (ShaderWarmup's effect: the level's other effects ran before it). */
  'levelMounted',
  /** Its sky env map baked into `scene.environment`. */
  'envBaked',
  /** Its shader warm-up finished (`sceneReady`). */
  'warmupDone',
  /** The first frame in `playing`. */
  'firstPlayingFrame',
] as const

export type StartupPhase = (typeof STARTUP_PHASES)[number]

const marked = new Set<StartupPhase>()

export function markStartup(phase: StartupPhase): void {
  if (marked.has(phase)) return
  marked.add(phase)
  performance.mark(`sc:${phase}`)
}

/** ms from navigation to each phase reached so far. */
export function startupTimings(): Partial<Record<StartupPhase, number>> {
  const out: Partial<Record<StartupPhase, number>> = {}
  for (const phase of STARTUP_PHASES) {
    const entry = performance.getEntriesByName(`sc:${phase}`, 'mark')[0]
    if (entry) out[phase] = Math.round(entry.startTime)
  }
  return out
}
